import {
  ExportResolution,
  SceneAsset,
  StudioConfig,
  VerseItem,
} from '../types/studio';
import { loadAndStitchRecitation, StitchedRecitation } from './audioEngine';
import { LoadedMediaMap, renderStudioFrame } from './canvasRenderer';
import { computeTimelineSegments, getPlaybackFrameState } from './timeline';

export interface ExportOptions {
  verses: VerseItem[];
  scenes: SceneAsset[];
  mediaMap: LoadedMediaMap;
  config: StudioConfig;
  resolution: ExportResolution;
  includeAudio: boolean;
  stitchedRecitation: StitchedRecitation | null;
  onProgress: (fraction: number, label: string) => void;
  signal: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  mimeType: string;
  extension: string;
  audioIncluded: boolean;
}

function getResolutionDimensions(resolution: ExportResolution): {
  width: number;
  height: number;
  bitrate: number;
} {
  if (resolution === '4k') {
    return { width: 2160, height: 3840, bitrate: 16_000_000 };
  }
  if (resolution === '1080p') {
    return { width: 1080, height: 1920, bitrate: 8_000_000 };
  }
  return { width: 720, height: 1280, bitrate: 4_500_000 };
}

function pickSupportedMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: '', extension: 'webm' };
}

/**
 * Records the 9:16 Quran video (720p, 1080p, or 4K UHD) on an offscreen canvas,
 * mixing the continuous gapless stitched recitation AudioBuffer directly so there
 * are zero audio cuts or gaps between verses.
 */
export async function exportQuranVideo(options: ExportOptions): Promise<ExportResult> {
  const {
    verses,
    scenes,
    mediaMap,
    config,
    resolution,
    includeAudio,
    stitchedRecitation,
    onProgress,
    signal,
  } = options;

  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Votre navigateur ne prend pas en charge l’enregistrement vidéo natif.');
  }

  const { width, height, bitrate } = getResolutionDimensions(resolution);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossible d’initialiser le contexte graphique d’export.');
  }

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  let audioCtx: AudioContext | null = null;
  let audioSource: AudioBufferSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let freqData: Uint8Array<ArrayBuffer> | null = null;
  let audioIncluded = false;
  let activeMasterBuffer: AudioBuffer | null = null;
  let effectiveVerses = verses;

  const videoStream = canvas.captureStream(30);
  const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

  if (includeAudio && config.audioEnabled && verses.length > 0) {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AudioContextCtor();
      await audioCtx.resume();

      let recitation = stitchedRecitation;
      if (!recitation) {
        onProgress(0.03, 'Assemblage audio continu sans coupure…');
        recitation = await loadAndStitchRecitation(
          audioCtx,
          verses,
          config.reciterId,
          signal
        );
      }

      if (recitation.verseDurations.length === verses.length) {
        effectiveVerses = verses.map((v, idx) => ({
          ...v,
          duration: recitation!.verseDurations[idx],
        }));
      }

      activeMasterBuffer = recitation.buffer;

      const dest = audioCtx.createMediaStreamDestination();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      freqData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = activeMasterBuffer;
      audioSource.connect(analyser);
      analyser.connect(dest);

      const audioTracks = dest.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        tracks.push(...audioTracks);
        audioIncluded = true;
      }
    } catch {
      audioIncluded = false;
    }
  }

  const { segments, totalDuration } = computeTimelineSegments(effectiveVerses);
  const fixedSceneIdx = Math.max(
    0,
    scenes.findIndex((s) => s.id === config.activeSceneId)
  );

  const combinedStream = new MediaStream(tracks);
  const { mimeType, extension } = pickSupportedMimeType();

  const recorder = new MediaRecorder(
    combinedStream,
    mimeType ? { mimeType, videoBitsPerSecond: bitrate } : undefined
  );

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  return new Promise<ExportResult>((resolve, reject) => {
    let rafId = 0;
    let finished = false;

    const cleanup = () => {
      cancelAnimationFrame(rafId);
      if (audioSource) {
        try {
          audioSource.stop();
        } catch {
          // already stopped
        }
        audioSource.disconnect();
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
      combinedStream.getTracks().forEach((t) => t.stop());
    };

    const handleAbort = () => {
      if (finished) return;
      finished = true;
      try {
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        // ignore
      }
      cleanup();
      reject(new Error('Export annulé.'));
    };

    signal.addEventListener('abort', handleAbort, { once: true });

    recorder.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('Erreur pendant l’encodage de la vidéo.'));
    };

    recorder.onstop = () => {
      if (finished) return;
      finished = true;
      cleanup();
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        mimeType: mimeType || 'video/webm',
        extension,
        audioIncluded,
      });
    };

    const startTime = performance.now();
    const audioStartCtxTime = audioCtx ? audioCtx.currentTime : 0;
    recorder.start(250);
    if (audioSource && audioIncluded) {
      audioSource.start(audioStartCtxTime, 0);
    }

    const tick = (now: number) => {
      if (signal.aborted || finished) return;

      const elapsed =
        audioCtx && audioIncluded
          ? Math.max(0, audioCtx.currentTime - audioStartCtxTime)
          : (now - startTime) / 1000;

      const clampedElapsed = Math.min(elapsed, totalDuration);
      const frame = getPlaybackFrameState(
        segments,
        clampedElapsed,
        scenes.length,
        config.autoCycleScenes,
        fixedSceneIdx,
        config.transitionDuration,
        config.sceneTransition
      );

      let audioLevel = 0;
      if (analyser && freqData && audioIncluded) {
        analyser.getByteFrequencyData(freqData);
        let sum = 0;
        for (let i = 0; i < freqData.length; i++) sum += freqData[i];
        audioLevel = Math.min(1, sum / (freqData.length * 145));
      }

      if (frame) {
        renderStudioFrame(
          ctx,
          width,
          height,
          frame,
          scenes,
          mediaMap,
          config,
          clampedElapsed,
          true,
          audioLevel
        );

        const pct = Math.min(0.99, clampedElapsed / Math.max(0.1, totalDuration));
        onProgress(
          pct,
          `Rendu ${resolution.toUpperCase()} · Verset ${frame.activeIndex + 1}/${effectiveVerses.length}…`
        );
      }

      if (elapsed >= totalDuration) {
        onProgress(1, 'Finalisation du fichier vidéo…');
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}
