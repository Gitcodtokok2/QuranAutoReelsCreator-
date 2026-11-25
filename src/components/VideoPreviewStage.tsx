import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AudioSyncStatus,
  SceneAsset,
  StudioConfig,
  VerseItem,
} from '../types/studio';
import { StitchedRecitation } from '../utils/audioEngine';
import { LoadedMediaMap, renderStudioFrame } from '../utils/canvasRenderer';
import {
  computeTimelineSegments,
  formatTimecode,
  getPlaybackFrameState,
} from '../utils/timeline';

interface VideoPreviewStageProps {
  verses: VerseItem[];
  scenes: SceneAsset[];
  mediaMap: LoadedMediaMap;
  mediaVersion: number;
  config: StudioConfig;
  isPlaying: boolean;
  currentTime: number;
  seekVersion: number;
  stitchedRecitation: StitchedRecitation | null;
  audioSyncStatus: AudioSyncStatus;
  getAudioContext: () => AudioContext;
  onSetIsPlaying: (playing: boolean) => void;
  onSeek: (time: number) => void;
  onActiveVerseChange: (index: number) => void;
  onUpdateConfig: (patch: Partial<StudioConfig>) => void;
}

// High-DPI crisp 9:16 preview buffer
const PREVIEW_W = 720;
const PREVIEW_H = 1280;

export function VideoPreviewStage({
  verses,
  scenes,
  mediaMap,
  mediaVersion,
  config,
  isPlaying,
  currentTime,
  seekVersion,
  stitchedRecitation,
  audioSyncStatus,
  getAudioContext,
  onSetIsPlaying,
  onSeek,
  onActiveVerseChange,
  onUpdateConfig,
}: VideoPreviewStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const audioClockRef = useRef<{
    active: boolean;
    ctxStartTime: number;
    perfStartTime: number;
    offsetSec: number;
    bufferDuration: number;
  }>({
    active: false,
    ctxStartTime: 0,
    perfStartTime: 0,
    offsetSec: 0,
    bufferDuration: 0,
  });

  const currentTimeRef = useRef(currentTime);
  const [displayTime, setDisplayTime] = useState(currentTime);
  const [activeIndex, setActiveIndex] = useState(0);

  const { segments, totalDuration } = useMemo(
    () => computeTimelineSegments(verses),
    [verses]
  );

  const fixedSceneIndex = useMemo(() => {
    const idx = scenes.findIndex((s) => s.id === config.activeSceneId);
    return idx >= 0 ? idx : 0;
  }, [scenes, config.activeSceneId]);

  const configRef = useRef(config);
  configRef.current = config;
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const fixedSceneRef = useRef(fixedSceneIndex);
  fixedSceneRef.current = fixedSceneIndex;
  const totalDurationRef = useRef(totalDuration);
  totalDurationRef.current = totalDuration;

  const stopGaplessAudio = () => {
    audioClockRef.current.active = false;
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
  };

  // Sync external seek changes (clicking a verse, transition preview, or changing passage)
  useEffect(() => {
    currentTimeRef.current = currentTime;
    setDisplayTime(currentTime);
    const frame = getPlaybackFrameState(
      segments,
      currentTime,
      scenes.length,
      config.autoCycleScenes,
      fixedSceneIndex,
      config.transitionDuration,
      config.sceneTransition
    );
    if (frame) {
      setActiveIndex(frame.activeIndex);
      onActiveVerseChange(frame.activeIndex);
    }
  }, [
    currentTime,
    seekVersion,
    segments,
    scenes.length,
    config.autoCycleScenes,
    config.transitionDuration,
    config.sceneTransition,
    fixedSceneIndex,
    onActiveVerseChange,
  ]);

  // Start / Stop continuous gapless master AudioBufferSourceNode locked to timeline
  useEffect(() => {
    stopGaplessAudio();

    if (!isPlaying || !config.audioEnabled || !stitchedRecitation) {
      return;
    }

    let cancelled = false;
    const startContinuousAudio = async () => {
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (cancelled) return;

        const buffer = stitchedRecitation.buffer;
        const safeOffset =
          buffer.duration > 0
            ? ((currentTimeRef.current % buffer.duration) + buffer.duration) %
              buffer.duration
            : 0;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        analyserRef.current = analyser;
        freqDataRef.current = new Uint8Array(
          new ArrayBuffer(analyser.frequencyBinCount)
        );

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        const nowCtx = ctx.currentTime;
        source.start(nowCtx, safeOffset);
        sourceNodeRef.current = source;

        audioClockRef.current = {
          active: true,
          ctxStartTime: nowCtx,
          perfStartTime: performance.now(),
          offsetSec: safeOffset,
          bufferDuration: buffer.duration,
        };
      } catch {
        audioClockRef.current.active = false;
      }
    };

    startContinuousAudio();

    return () => {
      cancelled = true;
      stopGaplessAudio();
    };
  }, [
    isPlaying,
    config.audioEnabled,
    stitchedRecitation,
    currentTime,
    seekVersion,
    getAudioContext,
  ]);

  // Main 60fps Canvas Animation Loop + Real-time Voice Reactivity
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastNow = performance.now();
    let lastHudUpdate = 0;
    let lastReportedIdx = -1;

    const getLiveAudioLevel = (): number => {
      const analyser = analyserRef.current;
      const data = freqDataRef.current;
      if (!analyser || !data || !audioClockRef.current.active) return 0;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      return Math.min(1, sum / (data.length * 135));
    };

    const drawAt = (t: number, audioLvl: number) => {
      const frame = getPlaybackFrameState(
        segmentsRef.current,
        t,
        scenesRef.current.length,
        configRef.current.autoCycleScenes,
        fixedSceneRef.current,
        configRef.current.transitionDuration,
        configRef.current.sceneTransition
      );
      if (!frame) return null;

      renderStudioFrame(
        ctx,
        PREVIEW_W,
        PREVIEW_H,
        frame,
        scenesRef.current,
        mediaMap,
        configRef.current,
        t,
        false,
        audioLvl
      );
      return frame;
    };

    drawAt(currentTimeRef.current, 0);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        drawAt(currentTimeRef.current, 0);
      });
    }

    if (!isPlaying) {
      return;
    }

    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastNow) / 1000);
      lastNow = now;

      let nextTime: number;
      if (audioClockRef.current.active && audioClockRef.current.bufferDuration > 0) {
        // Lock timeline sample-accurately to the continuous audio clock when hardware clock advances,
        // otherwise fall back smoothly to frame delta so playback never freezes on silent/headless devices
        const audioCtx = getAudioContext();
        const elapsedAudio = Math.max(
          0,
          audioCtx.currentTime - audioClockRef.current.ctxStartTime
        );
        const dur = Math.max(0.1, totalDurationRef.current);
        if (audioCtx.state === 'running' && elapsedAudio > 0.01) {
          nextTime = (audioClockRef.current.offsetSec + elapsedAudio) % dur;
        } else {
          nextTime = (currentTimeRef.current + dt) % dur;
        }
      } else {
        nextTime = currentTimeRef.current + dt;
        if (nextTime >= totalDurationRef.current) {
          nextTime = 0;
        }
      }

      currentTimeRef.current = nextTime;
      const audioLevel = getLiveAudioLevel();

      const frame = drawAt(nextTime, audioLevel);
      if (frame && frame.activeIndex !== lastReportedIdx) {
        lastReportedIdx = frame.activeIndex;
        setActiveIndex(frame.activeIndex);
        onActiveVerseChange(frame.activeIndex);
      }

      if (now - lastHudUpdate > 125) {
        lastHudUpdate = now;
        setDisplayTime(nextTime);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    isPlaying,
    config,
    verses,
    scenes,
    mediaMap,
    mediaVersion,
    currentTime,
    seekVersion,
    getAudioContext,
    onActiveVerseChange,
  ]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      onSeek(currentTimeRef.current);
      onSetIsPlaying(false);
    } else {
      onSetIsPlaying(true);
    }
  };

  const handlePrevVerse = () => {
    const targetIdx = Math.max(0, activeIndex - 1);
    const targetTime = segments[targetIdx]?.startTime ?? 0;
    onSeek(targetTime);
  };

  const handleNextVerse = () => {
    const targetIdx = Math.min(segments.length - 1, activeIndex + 1);
    const targetTime = segments[targetIdx]?.startTime ?? 0;
    onSeek(targetTime);
  };

  const activeVerse = verses[activeIndex] ?? verses[0];
  const currentSceneName = config.autoCycleScenes
    ? scenes[(fixedSceneIndex + activeIndex) % Math.max(1, scenes.length)]?.name ?? ''
    : scenes[fixedSceneIndex]?.name ?? '';

  return (
    <section
      aria-label="Aperçu vidéo vertical 9:16"
      className="flex flex-1 flex-col items-center justify-between px-4 py-5 sm:px-8 sm:py-6"
    >
      {/* Top quiet context strip */}
      <div className="mb-4 flex w-full max-w-[660px] flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
        <div className="flex items-center gap-2 truncate">
          <span className="font-medium text-zinc-200">
            {activeVerse ? `Sourate ${activeVerse.surahNameFr}` : 'Aperçu'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            Verset {activeIndex + 1}/{verses.length}
          </span>
          {currentSceneName && (
            <>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden truncate sm:inline">{currentSceneName}</span>
            </>
          )}
          {audioSyncStatus === 'syncing' && config.audioEnabled && (
            <>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin text-[#D4A853]" aria-hidden="true" />
                <span>Synchro audio…</span>
              </span>
            </>
          )}
          {audioSyncStatus === 'synced' && config.audioEnabled && (
            <>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden md:inline text-[#D4A853]/90">
                Audio continu
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateConfig({ showTikTokSafeZone: !config.showTikTokSafeZone })
          }
          aria-pressed={config.showTikTokSafeZone}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
            config.showTikTokSafeZone
              ? 'border-[#D4A853]/70 bg-[#D4A853]/15 text-[#F5E6C8]'
              : 'border-white/[0.1] bg-[#141419] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Repères TikTok</span>
        </button>
      </div>

      {/* Focal Anchor: 9:16 Vertical Canvas Preview */}
      <div className="relative flex flex-1 items-center justify-center w-full">
        <div
          data-testid="video-preview-frame"
          data-playing={isPlaying ? 'true' : 'false'}
          data-verse-index={activeIndex}
          data-audio-sync={audioSyncStatus}
          className="relative aspect-[9/16] w-full max-w-[310px] sm:max-w-[340px] lg:max-h-[calc(100vh-250px)] lg:w-auto overflow-hidden rounded-[24px] border border-white/[0.12] bg-black shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            data-testid="quran-video-canvas"
            onClick={handleTogglePlay}
            className="h-full w-full block cursor-pointer"
          />
        </div>
      </div>

      {/* Transport Controls & Interactive Verse Timeline Strip */}
      <div className="mt-5 w-full max-w-[660px] space-y-3">
        {/* Controls Row */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#121216] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrevVerse}
              aria-label="Verset précédent"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
            >
              <SkipBack className="h-4 w-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Mettre en pause' : 'Lire l’aperçu'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#D4A853] text-[#09090B] transition-transform duration-150 hover:bg-[#e2ba6a] active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A853]"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4 fill-current translate-x-[1px]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextVerse}
              aria-label="Verset suivant"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-zinc-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
            >
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div
            data-testid="timecode-display"
            className="font-mono-tabular text-xs text-zinc-300"
          >
            <span className="text-zinc-100">{formatTimecode(displayTime)}</span>
            <span className="mx-1.5 text-zinc-600">/</span>
            <span className="text-zinc-400">{formatTimecode(totalDuration)}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              onUpdateConfig({ audioEnabled: !config.audioEnabled })
            }
            aria-label={
              config.audioEnabled ? 'Couper la récitation' : 'Activer la récitation'
            }
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
          >
            {config.audioEnabled ? (
              <Volume2 className="h-4 w-4 text-[#D4A853]" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {config.audioEnabled ? 'Récitation' : 'Muet'}
            </span>
          </button>
        </div>

        {/* Interactive Verse Scrubber Segments */}
        <div
          role="group"
          aria-label="Ligne temporelle des versets"
          className="flex h-8 w-full items-stretch gap-1 overflow-hidden"
        >
          {segments.map((seg) => {
            const widthPct =
              totalDuration > 0
                ? (seg.duration / totalDuration) * 100
                : 100 / segments.length;
            const isCurrent = seg.index === activeIndex;
            const isPassed = displayTime >= seg.endTime;

            return (
              <button
                key={seg.verse.id}
                type="button"
                style={{ width: `${widthPct}%` }}
                onClick={() => onSeek(seg.startTime + 0.05)}
                aria-label={`Aller au verset ${seg.verse.ayahNumber}`}
                className={`group relative flex items-center justify-center rounded-md border px-1 text-[11px] font-mono-tabular transition-colors duration-150 overflow-hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                  isCurrent
                    ? 'border-[#D4A853] bg-[#D4A853]/20 text-[#F5E6C8]'
                    : isPassed
                    ? 'border-white/[0.08] bg-white/[0.08] text-zinc-300'
                    : 'border-white/[0.06] bg-[#121216] text-zinc-500 hover:border-white/[0.15] hover:text-zinc-300'
                }`}
              >
                <span className="truncate">{seg.verse.ayahNumber}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
