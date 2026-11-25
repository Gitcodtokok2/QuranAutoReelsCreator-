import {
  MemorizationRepeat,
  PlaybackFrameState,
  SceneTransitionStyle,
  SubtitleLanguage,
  TextAnimationStyle,
  TimelineSegment,
  VerseItem,
} from '../types/studio';

/**
 * Repeats each verse N times for Quran memorization (Hifz) videos while preserving unique segment IDs.
 */
export function expandVersesForMemorization(
  verses: VerseItem[],
  repeatCount: MemorizationRepeat
): VerseItem[] {
  if (repeatCount <= 1) return verses;
  const expanded: VerseItem[] = [];
  for (const verse of verses) {
    for (let pass = 1; pass <= repeatCount; pass++) {
      expanded.push({
        ...verse,
        id: `${verse.id}-r${pass}`,
        repeatPass: pass,
      });
    }
  }
  return expanded;
}

export interface SceneTransitionTransforms {
  outgoingAlpha: number;
  incomingAlpha: number;
  outgoingScale: number;
  incomingScale: number;
  outgoingOffsetY: number;
  incomingOffsetY: number;
  incomingEdgeShadow: number;
  outgoingBlurPx: number;
  incomingBlurPx: number;
  overlayColor: string | null;
  overlayAlpha: number;
}

/**
 * Computes sequential timeline segments from an array of verses.
 * Guarantees a minimum segment duration of 1.5s so transitions never divide by zero.
 */
export function computeTimelineSegments(verses: VerseItem[]): {
  segments: TimelineSegment[];
  totalDuration: number;
} {
  let cursor = 0;
  const segments: TimelineSegment[] = verses.map((verse, index) => {
    const duration = Math.max(1.5, Number.isFinite(verse.duration) ? verse.duration : 4);
    const startTime = cursor;
    const endTime = cursor + duration;
    cursor = endTime;
    return {
      index,
      verse,
      startTime,
      endTime,
      duration,
    };
  });
  return { segments, totalDuration: cursor };
}

/**
 * Computes the active verse, normalized progress, fade opacity envelope,
 * and automatic crossfade scene indices for any timestamp t.
 */
export function getPlaybackFrameState(
  segments: TimelineSegment[],
  currentTime: number,
  sceneCount: number,
  autoCycleScenes: boolean,
  fixedSceneIndex = 0,
  transitionDurationSec = 0.9,
  defaultTransition: SceneTransitionStyle = 'crossfade'
): PlaybackFrameState | null {
  if (segments.length === 0) {
    return null;
  }

  const totalDuration = segments[segments.length - 1].endTime;
  const clampedTime = Math.max(0, Math.min(currentTime, Math.max(0, totalDuration - 0.0001)));

  let activeIndex = segments.length - 1;
  for (let i = 0; i < segments.length; i++) {
    if (clampedTime >= segments[i].startTime && clampedTime < segments[i].endTime) {
      activeIndex = i;
      break;
    }
  }

  const activeSegment = segments[activeIndex];
  const verseElapsed = Math.max(0, clampedTime - activeSegment.startTime);
  const verseProgress = Math.max(0, Math.min(1, verseElapsed / activeSegment.duration));
  const transitionStyle: SceneTransitionStyle =
    activeSegment.verse.transitionOut ?? defaultTransition;

  // Smooth fade-in (first 0.45s) and fade-out (last 0.45s)
  const fadeWindow = Math.min(0.45, activeSegment.duration * 0.25);
  let fadeFactor = 1;
  if (verseElapsed < fadeWindow) {
    fadeFactor = easeOutCubic(verseElapsed / fadeWindow);
  } else if (activeSegment.duration - verseElapsed < fadeWindow) {
    fadeFactor = easeOutCubic((activeSegment.duration - verseElapsed) / fadeWindow);
  }

  const safeSceneCount = Math.max(1, sceneCount);
  const normalizedFixed = ((fixedSceneIndex % safeSceneCount) + safeSceneCount) % safeSceneCount;

  const prevArabic = activeIndex > 0 ? segments[activeIndex - 1].verse.arabic : undefined;
  const nextArabic =
    activeIndex < segments.length - 1 ? segments[activeIndex + 1].verse.arabic : undefined;

  if (!autoCycleScenes || safeSceneCount === 1) {
    return {
      activeIndex,
      activeSegment,
      prevArabic,
      nextArabic,
      verseElapsed,
      verseProgress,
      fadeFactor,
      sceneIndex: normalizedFixed,
      nextSceneIndex: normalizedFixed,
      sceneBlend: 0,
      transitionStyle,
      totalDuration,
    };
  }

  // Auto-cycle scenes smoothly across verses (offset by fixedSceneIndex so user's chosen starting scene leads)
  const sceneIndex = (normalizedFixed + activeIndex) % safeSceneCount;
  const nextSceneIndex = (normalizedFixed + activeIndex + 1) % safeSceneCount;

  // Compute smooth transition window at the end of each verse when another verse follows
  const safeTransDur = Math.max(
    0.2,
    Math.min(transitionDurationSec, activeSegment.duration * 0.48)
  );
  const remaining = activeSegment.duration - verseElapsed;
  let sceneBlend = 0;
  if (activeIndex < segments.length - 1 && remaining < safeTransDur) {
    const raw = (safeTransDur - remaining) / safeTransDur;
    sceneBlend = easeInOutCubic(Math.max(0, Math.min(1, raw)));
  }

  return {
    activeIndex,
    activeSegment,
    prevArabic,
    nextArabic,
    verseElapsed,
    verseProgress,
    fadeFactor,
    sceneIndex,
    nextSceneIndex,
    sceneBlend,
    transitionStyle,
    totalDuration,
  };
}

/**
 * Pure helper: translates a normalized sceneBlend (0..1) and cinematic transition style
 * into deterministic alpha, zoom scale, optical blur, and atmospheric overlay parameters.
 */
export function computeTransitionTransforms(
  style: SceneTransitionStyle,
  blend: number
): SceneTransitionTransforms {
  const t = Math.max(0, Math.min(1, blend));
  if (t <= 0.001) {
    return {
      outgoingAlpha: 1,
      incomingAlpha: 0,
      outgoingScale: 1,
      incomingScale: 1,
      outgoingOffsetY: 0,
      incomingOffsetY: 0,
      incomingEdgeShadow: 0,
      outgoingBlurPx: 0,
      incomingBlurPx: 0,
      overlayColor: null,
      overlayAlpha: 0,
    };
  }

  if (style === 'slide-up') {
    // Reels/TikTok vertical upward glide: incoming rises 100% -> 0%, outgoing drifts up with subtle parallax
    return {
      outgoingAlpha: 1 - t * 0.35,
      incomingAlpha: 1,
      outgoingScale: 1,
      incomingScale: 1,
      outgoingOffsetY: -0.32 * t,
      incomingOffsetY: 1 - t,
      incomingEdgeShadow: Math.sin(t * Math.PI),
      outgoingBlurPx: 0,
      incomingBlurPx: 0,
      overlayColor: null,
      overlayAlpha: 0,
    };
  }

  if (style === 'slow-zoom') {
    return {
      outgoingAlpha: 1 - t * 0.85,
      incomingAlpha: t,
      outgoingScale: 1 + t * 0.14,
      incomingScale: 0.94 + t * 0.06,
      outgoingOffsetY: 0,
      incomingOffsetY: 0,
      incomingEdgeShadow: 0,
      outgoingBlurPx: t * 3,
      incomingBlurPx: (1 - t) * 2.5,
      overlayColor: null,
      overlayAlpha: 0,
    };
  }

  if (style === 'cinematic-blur') {
    // Peak Gaussian blur in the middle of the cut for optical rack-focus feel
    const peak = Math.sin(t * Math.PI);
    return {
      outgoingAlpha: 1 - t * 0.9,
      incomingAlpha: t,
      outgoingScale: 1 + t * 0.03,
      incomingScale: 1.03 - t * 0.03,
      outgoingOffsetY: 0,
      incomingOffsetY: 0,
      incomingEdgeShadow: 0,
      outgoingBlurPx: peak * 18,
      incomingBlurPx: peak * 18,
      overlayColor: null,
      overlayAlpha: 0,
    };
  }

  if (style === 'golden-flash') {
    const peak = Math.pow(Math.sin(t * Math.PI), 1.4);
    return {
      outgoingAlpha: t < 0.5 ? 1 : 1 - (t - 0.5) * 2,
      incomingAlpha: t < 0.5 ? t * 2 * 0.5 : 0.5 + (t - 0.5),
      outgoingScale: 1 + t * 0.04,
      incomingScale: 1.04 - t * 0.04,
      outgoingOffsetY: 0,
      incomingOffsetY: 0,
      incomingEdgeShadow: 0,
      outgoingBlurPx: peak * 5,
      incomingBlurPx: peak * 5,
      overlayColor: '#F5DCA0',
      overlayAlpha: peak * 0.42,
    };
  }

  if (style === 'dip-black') {
    const peak = Math.sin(t * Math.PI);
    return {
      outgoingAlpha: t < 0.5 ? 1 - t * 2 : 0,
      incomingAlpha: t < 0.5 ? 0 : (t - 0.5) * 2,
      outgoingScale: 1,
      incomingScale: 1,
      outgoingOffsetY: 0,
      incomingOffsetY: 0,
      incomingEdgeShadow: 0,
      outgoingBlurPx: 0,
      incomingBlurPx: 0,
      overlayColor: '#050507',
      overlayAlpha: peak * 0.88,
    };
  }

  // Default: 'crossfade'
  return {
    outgoingAlpha: 1,
    incomingAlpha: t,
    outgoingScale: 1,
    incomingScale: 1,
    outgoingOffsetY: 0,
    incomingOffsetY: 0,
    incomingEdgeShadow: 0,
    outgoingBlurPx: 0,
    incomingBlurPx: 0,
    overlayColor: null,
    overlayAlpha: 0,
  };
}

export function easeOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutCubic(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Calculates how many words of a verse should be revealed at a given verseProgress (0..1).
 */
export function computeWordRevealCount(
  text: string,
  progress: number,
  mode: TextAnimationStyle
): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  if (
    mode === 'cinematic-fade' ||
    mode === 'vertical-rise' ||
    mode === 'line-reveal' ||
    mode === 'dynamic-focus' ||
    mode === 'mask-reveal'
  ) {
    return words.length;
  }

  // Reveal words smoothly between 6% and 84% of verse duration so full verse rests visibly
  const start = 0.06;
  const end = 0.84;
  if (progress <= start) return 1;
  if (progress >= end) return words.length;

  const normalized = (progress - start) / (end - start);
  return Math.max(1, Math.min(words.length, Math.ceil(normalized * words.length)));
}

/**
 * Converts a positive integer into Eastern Arabic-Indic digits for Mushaf Ayah medallions.
 */
export function toArabicIndicNumerals(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(Math.max(0, Math.floor(num)))
    .split('')
    .map((ch) => digits[Number(ch)] ?? ch)
    .join('');
}

/**
 * Formats seconds as MM:SS for studio HUD transport controls.
 */
export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalSec = Math.floor(safe);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Formats seconds as HH:MM:SS,mmm for SRT subtitle export.
 */
export function formatSrtTimestamp(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  const totalSec = Math.floor(safe);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )},${String(ms).padStart(3, '0')}`;
}

/**
 * Generates standard .srt subtitle text for the active verses and subtitle language mode.
 */
export function generateSrtSubtitles(
  verses: VerseItem[],
  language: SubtitleLanguage
): string {
  const { segments } = computeTimelineSegments(verses);
  return segments
    .map((seg, idx) => {
      const start = formatSrtTimestamp(seg.startTime);
      const end = formatSrtTimestamp(seg.endTime);
      const lines: string[] = [];
      if (
        language === 'ar-only' ||
        language === 'ar-fr' ||
        language === 'ar-en' ||
        language === 'ar-fr-en'
      ) {
        lines.push(seg.verse.arabic);
      }
      if (language === 'ar-fr' || language === 'fr-only' || language === 'ar-fr-en') {
        lines.push(seg.verse.french);
      }
      if (language === 'ar-en' || language === 'ar-fr-en') {
        lines.push(seg.verse.english);
      }
      return `${idx + 1}\n${start} --> ${end}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

/**
 * Validates and clamps Surah range selection (limits to max 20 verses per video reel for crisp TikTok pacing).
 */
export function validateSurahRange(
  fromAyah: number,
  toAyah: number,
  maxAyahs: number,
  maxClipVerses = 20
): { from: number; to: number; error: string | null } {
  if (!Number.isInteger(fromAyah) || !Number.isInteger(toAyah)) {
    return { from: 1, to: Math.min(5, maxAyahs), error: 'Veuillez saisir des numéros de versets valides.' };
  }
  if (fromAyah < 1 || fromAyah > maxAyahs) {
    return {
      from: Math.max(1, Math.min(fromAyah, maxAyahs)),
      to: Math.max(1, Math.min(toAyah, maxAyahs)),
      error: `Le verset de début doit être compris entre 1 et ${maxAyahs}.`,
    };
  }
  if (toAyah < fromAyah) {
    return {
      from: fromAyah,
      to: fromAyah,
      error: 'Le verset de fin doit être supérieur ou égal au verset de début.',
    };
  }
  if (toAyah > maxAyahs) {
    return {
      from: fromAyah,
      to: maxAyahs,
      error: `Cette sourate contient au maximum ${maxAyahs} versets.`,
    };
  }
  if (toAyah - fromAyah + 1 > maxClipVerses) {
    return {
      from: fromAyah,
      to: fromAyah + maxClipVerses - 1,
      error: `Pour un format TikTok fluide, sélectionnez au maximum ${maxClipVerses} versets par vidéo.`,
    };
  }
  return { from: fromAyah, to: toAyah, error: null };
}

/**
 * Estimates natural recitation duration (in seconds) based on Arabic word count.
 */
export function estimateVerseDuration(arabicText: string): number {
  const wordCount = arabicText.trim().split(/\s+/).filter(Boolean).length;
  // Average measured Quranic recitation pace ~ 0.85s per word + 1.4s breathing cadence
  return Math.max(3.2, Math.min(18, Math.round((wordCount * 0.85 + 1.4) * 10) / 10));
}
