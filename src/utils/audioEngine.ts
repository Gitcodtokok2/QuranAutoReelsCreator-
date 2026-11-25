import { getVerseAudioUrl } from '../services/quranApi';
import { VerseItem } from '../types/studio';

export interface GaplessVerseTiming {
  verseIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  trimStartSample: number;
  trimEndSample: number;
}

export interface StitchedRecitation {
  buffer: AudioBuffer;
  timings: GaplessVerseTiming[];
  totalDuration: number;
  verseDurations: number[];
}

/**
 * Pure helper: finds the non-silent sample bounds of an audio channel
 * while keeping natural breathing padding so consecutive ayahs flow organically
 * without jarring dead air or clipped endings.
 */
export function trimSilenceBounds(
  channelData: Float32Array,
  sampleRate: number,
  threshold = 0.006,
  padLeadSec = 0.04,
  padTailSec = 0.14
): { startSample: number; endSample: number } {
  const len = channelData.length;
  if (len === 0 || sampleRate <= 0) {
    return { startSample: 0, endSample: 0 };
  }

  let firstLoud = 0;
  while (firstLoud < len && Math.abs(channelData[firstLoud]) < threshold) {
    firstLoud++;
  }

  let lastLoud = len - 1;
  while (lastLoud > firstLoud && Math.abs(channelData[lastLoud]) < threshold) {
    lastLoud--;
  }

  // If the entire buffer is quiet, preserve it intact
  if (firstLoud >= lastLoud) {
    return { startSample: 0, endSample: len };
  }

  const leadPad = Math.round(padLeadSec * sampleRate);
  const tailPad = Math.round(padTailSec * sampleRate);

  const startSample = Math.max(0, firstLoud - leadPad);
  const endSample = Math.min(len, lastLoud + tailPad);
  return { startSample, endSample };
}

/**
 * Pure helper: computes exact gapless timeline segments with gentle overlap crossfades
 * so the reciter's voice flows seamlessly from verse to verse without cuts or silences.
 */
export function buildGaplessAudioPlan(
  rawDurations: number[],
  crossfadeSec = 0.06
): {
  segments: { startTime: number; endTime: number; duration: number }[];
  totalDuration: number;
} {
  if (rawDurations.length === 0) {
    return { segments: [], totalDuration: 0 };
  }

  const safeFade = Math.max(0, Math.min(0.25, crossfadeSec));
  const segments: { startTime: number; endTime: number; duration: number }[] = [];
  let cursor = 0;

  for (let i = 0; i < rawDurations.length; i++) {
    const rawDur = Math.max(0.4, Number.isFinite(rawDurations[i]) ? rawDurations[i] : 3.5);
    const overlap = i < rawDurations.length - 1 ? Math.min(safeFade, rawDur * 0.2) : 0;
    const effectiveDur = Math.max(0.3, rawDur - overlap);
    const startTime = cursor;
    const endTime = cursor + effectiveDur;
    segments.push({ startTime, endTime, duration: effectiveDur });
    cursor = endTime;
  }

  return { segments, totalDuration: cursor };
}

/**
 * Stitches multiple decoded verse AudioBuffers into a single continuous, gapless AudioBuffer
 * with silky crossfade joins and returns exact per-verse durations synced to the master track.
 */
export function stitchVerseBuffers(
  audioCtx: BaseAudioContext,
  buffers: AudioBuffer[],
  crossfadeSec = 0.06
): StitchedRecitation {
  if (buffers.length === 0) {
    throw new Error('Aucun tampon audio à assembler.');
  }

  const sampleRate = buffers[0].sampleRate;
  const numChannels = Math.min(2, Math.max(...buffers.map((b) => b.numberOfChannels)));

  // 1. Trim excessive leading/trailing dead air from each ayah clip
  const trimmed = buffers.map((buf) => {
    const ch0 = buf.getChannelData(0);
    const { startSample, endSample } = trimSilenceBounds(ch0, buf.sampleRate);
    const length = Math.max(1, endSample - startSample);
    return {
      buf,
      startSample,
      endSample,
      length,
      duration: length / buf.sampleRate,
    };
  });

  // 2. Compute exact gapless offsets
  const crossfadeSamples = Math.round(crossfadeSec * sampleRate);
  let totalSamples = 0;
  const placements: {
    offsetSamples: number;
    lengthSamples: number;
    overlapNext: number;
  }[] = [];

  for (let i = 0; i < trimmed.length; i++) {
    const item = trimmed[i];
    const len = item.length;
    const overlapNext =
      i < trimmed.length - 1
        ? Math.min(crossfadeSamples, Math.floor(len * 0.15), Math.floor(trimmed[i + 1].length * 0.15))
        : 0;
    placements.push({
      offsetSamples: totalSamples,
      lengthSamples: len,
      overlapNext,
    });
    totalSamples += len - overlapNext;
  }

  // 3. Allocate one continuous master AudioBuffer and mix with smooth equal-power crossfades
  const master = audioCtx.createBuffer(numChannels, Math.max(1, totalSamples), sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const out = master.getChannelData(ch);

    for (let i = 0; i < trimmed.length; i++) {
      const item = trimmed[i];
      const place = placements[i];
      const srcChannel = Math.min(ch, item.buf.numberOfChannels - 1);
      const src = item.buf.getChannelData(srcChannel);

      const prevOverlap = i > 0 ? placements[i - 1].overlapNext : 0;
      const nextOverlap = place.overlapNext;

      for (let s = 0; s < place.lengthSamples; s++) {
        const outIdx = place.offsetSamples + s;
        if (outIdx >= out.length) break;

        let gain = 1;
        // Gentle fade-in over overlap with previous ayah (or 15ms micro-ramp on first ayah)
        if (i === 0 && s < Math.min(600, place.lengthSamples)) {
          gain = s / Math.min(600, place.lengthSamples);
        } else if (prevOverlap > 0 && s < prevOverlap) {
          gain = s / prevOverlap;
        }

        // Gentle fade-out over overlap into next ayah (or 40ms tail on final ayah)
        const distFromEnd = place.lengthSamples - 1 - s;
        if (i === trimmed.length - 1 && distFromEnd < Math.min(1800, place.lengthSamples)) {
          gain *= distFromEnd / Math.min(1800, place.lengthSamples);
        } else if (nextOverlap > 0 && distFromEnd < nextOverlap) {
          gain *= distFromEnd / nextOverlap;
        }

        out[outIdx] += src[item.startSample + s] * gain;
      }
    }
  }

  // 4. Build exact per-verse timings aligned to the master buffer clock
  const timings: GaplessVerseTiming[] = placements.map((place, i) => {
    const startTime = place.offsetSamples / sampleRate;
    const endSamples =
      i < placements.length - 1
        ? placements[i + 1].offsetSamples
        : totalSamples;
    const endTime = endSamples / sampleRate;
    return {
      verseIndex: i,
      startTime,
      endTime,
      duration: Math.max(0.5, Number((endTime - startTime).toFixed(2))),
      trimStartSample: trimmed[i].startSample,
      trimEndSample: trimmed[i].endSample,
    };
  });

  const totalDuration = totalSamples / sampleRate;
  const verseDurations = timings.map((t) => t.duration);

  return {
    buffer: master,
    timings,
    totalDuration,
    verseDurations,
  };
}

/**
 * Downloads and decodes all verses for a passage + reciter from CORS-enabled EveryAyah
 * and returns a single gapless stitched master AudioBuffer.
 */
export async function loadAndStitchRecitation(
  audioCtx: AudioContext,
  verses: VerseItem[],
  reciterId: string,
  signal: AbortSignal
): Promise<StitchedRecitation> {
  if (verses.length === 0) {
    throw new Error('Aucun verset à charger.');
  }

  const arrayBuffers = await Promise.all(
    verses.map(async (verse) => {
      const url = getVerseAudioUrl(verse.surahNumber, verse.ayahNumber, reciterId);
      const res = await fetch(url, { mode: 'cors', signal });
      if (!res.ok) {
        throw new Error(`Audio indisponible pour le verset ${verse.ayahNumber}`);
      }
      return res.arrayBuffer();
    })
  );

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  const decodedBuffers: AudioBuffer[] = [];
  for (const ab of arrayBuffers) {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const decoded = await audioCtx.decodeAudioData(ab.slice(0));
    decodedBuffers.push(decoded);
  }

  return stitchVerseBuffers(audioCtx, decodedBuffers, 0.06);
}
