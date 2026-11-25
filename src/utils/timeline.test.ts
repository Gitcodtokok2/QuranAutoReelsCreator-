import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTimelineSegments,
  computeTransitionTransforms,
  computeWordRevealCount,
  estimateVerseDuration,
  expandVersesForMemorization,
  formatSrtTimestamp,
  formatTimecode,
  generateSrtSubtitles,
  getPlaybackFrameState,
  toArabicIndicNumerals,
  validateSurahRange,
} from './timeline';
import { VerseItem } from '../types/studio';

const sampleVerses: VerseItem[] = [
  {
    id: '94-1',
    surahNumber: 94,
    surahNameFr: 'Al-Inshirah',
    surahNameAr: 'الشرح',
    ayahNumber: 1,
    globalAyahNumber: 6091,
    arabic: 'أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ',
    french: 'N’avons-Nous pas ouvert pour toi ta poitrine ?',
    english: 'Did We not expand for you your breast?',
    duration: 4,
  },
  {
    id: '94-2',
    surahNumber: 94,
    surahNameFr: 'Al-Inshirah',
    surahNameAr: 'الشرح',
    ayahNumber: 2,
    globalAyahNumber: 6092,
    arabic: 'وَوَضَعْنَا عَنكَ وِزْرَكَ',
    french: 'Et ne t’avons-Nous pas déchargé du fardeau',
    english: 'And We removed from you your burden',
    duration: 5,
  },
];

test('computeTimelineSegments sums durations sequentially with minimum guard', () => {
  const { segments, totalDuration } = computeTimelineSegments(sampleVerses);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].startTime, 0);
  assert.equal(segments[0].endTime, 4);
  assert.equal(segments[1].startTime, 4);
  assert.equal(segments[1].endTime, 9);
  assert.equal(totalDuration, 9);

  const clamped = computeTimelineSegments([{ ...sampleVerses[0], duration: 0.2 }]);
  assert.equal(clamped.totalDuration, 1.5);
});

test('getPlaybackFrameState resolves active verse and crossfade blend across scenes', () => {
  const { segments } = computeTimelineSegments(sampleVerses);

  const early = getPlaybackFrameState(segments, 1.0, 5, true, 0);
  assert.ok(early);
  assert.equal(early.activeIndex, 0);
  assert.equal(early.sceneIndex, 0);
  assert.equal(early.sceneBlend, 0);

  // Near end of first verse (3.8s of 4s => progress 0.95 > 0.82) should crossfade to scene 1
  const crossfade = getPlaybackFrameState(segments, 3.8, 5, true, 0);
  assert.ok(crossfade);
  assert.equal(crossfade.activeIndex, 0);
  assert.equal(crossfade.sceneIndex, 0);
  assert.equal(crossfade.nextSceneIndex, 1);
  assert.ok(crossfade.sceneBlend > 0.5 && crossfade.sceneBlend < 1);

  // In second verse with fixed scene mode (autoCycleScenes=false)
  const fixed = getPlaybackFrameState(segments, 5.5, 5, false, 3);
  assert.ok(fixed);
  assert.equal(fixed.activeIndex, 1);
  assert.equal(fixed.sceneIndex, 3);
  assert.equal(fixed.sceneBlend, 0);
});

test('computeWordRevealCount reveals words progressively in karaoke mode and immediately in fade mode', () => {
  const text = 'À côté de la difficulté est une facilité';
  assert.equal(computeWordRevealCount(text, 0.02, 'karaoke'), 1);
  assert.equal(computeWordRevealCount(text, 0.5, 'karaoke'), 5);
  assert.equal(computeWordRevealCount(text, 0.9, 'karaoke'), 8);
  assert.equal(computeWordRevealCount(text, 0.1, 'cinematic-fade'), 8);
});

test('formatTimecode and formatSrtTimestamp format tabular timestamps accurately', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(65.9), '01:05');
  assert.equal(formatSrtTimestamp(4.5), '00:00:04,500');
  assert.equal(formatSrtTimestamp(3661.25), '01:01:01,250');
});

test('generateSrtSubtitles builds valid multi-line SRT output respecting language mode', () => {
  const srtArFr = generateSrtSubtitles(sampleVerses, 'ar-fr');
  assert.ok(srtArFr.includes('1\n00:00:00,000 --> 00:00:04,000'));
  assert.ok(srtArFr.includes(sampleVerses[0].arabic));
  assert.ok(srtArFr.includes(sampleVerses[0].french));

  const srtFrOnly = generateSrtSubtitles(sampleVerses, 'fr-only');
  assert.ok(!srtFrOnly.includes(sampleVerses[0].arabic));
  assert.ok(srtFrOnly.includes(sampleVerses[1].french));
});

test('validateSurahRange enforces valid bounds and max clip size', () => {
  assert.equal(validateSurahRange(1, 8, 8).error, null);
  assert.ok(validateSurahRange(9, 10, 8).error !== null);
  assert.ok(validateSurahRange(5, 3, 8).error !== null);
  assert.ok(validateSurahRange(1, 25, 286, 20).error !== null);
});

test('estimateVerseDuration scales sensibly with verse length', () => {
  assert.ok(estimateVerseDuration('وَالضُّحَىٰ') >= 3.2);
  assert.ok(
    estimateVerseDuration('صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ') >
      estimateVerseDuration('وَالضُّحَىٰ')
  );
});

test('computeTransitionTransforms returns expected zoom, slide-up, blur, and overlay envelopes for every style', () => {
  const idle = computeTransitionTransforms('cinematic-blur', 0);
  assert.equal(idle.outgoingBlurPx, 0);
  assert.equal(idle.incomingAlpha, 0);
  assert.equal(idle.outgoingOffsetY, 0);
  assert.equal(idle.incomingOffsetY, 0);

  const zoomMid = computeTransitionTransforms('slow-zoom', 0.5);
  assert.ok(zoomMid.outgoingScale > 1.05);
  assert.ok(zoomMid.incomingScale < 1);

  const slideStart = computeTransitionTransforms('slide-up', 0);
  assert.equal(slideStart.outgoingOffsetY, 0);
  assert.equal(slideStart.incomingOffsetY, 0);
  assert.equal(slideStart.incomingAlpha, 0);

  const slideMid = computeTransitionTransforms('slide-up', 0.5);
  assert.ok(Math.abs(slideMid.outgoingOffsetY - -0.16) < 0.001);
  assert.ok(Math.abs(slideMid.incomingOffsetY - 0.5) < 0.001);
  assert.equal(slideMid.incomingAlpha, 1);
  assert.ok(slideMid.incomingEdgeShadow > 0.95);

  const slideEnd = computeTransitionTransforms('slide-up', 1);
  assert.ok(Math.abs(slideEnd.incomingOffsetY) < 0.001);
  assert.ok(Math.abs(slideEnd.outgoingOffsetY - -0.32) < 0.001);

  const blurMid = computeTransitionTransforms('cinematic-blur', 0.5);
  assert.ok(blurMid.outgoingBlurPx >= 17);
  assert.ok(blurMid.incomingBlurPx >= 17);

  const flashMid = computeTransitionTransforms('golden-flash', 0.5);
  assert.equal(flashMid.overlayColor, '#F5DCA0');
  assert.ok(flashMid.overlayAlpha > 0.35);

  const dipMid = computeTransitionTransforms('dip-black', 0.5);
  assert.equal(dipMid.overlayColor, '#050507');
  assert.ok(dipMid.overlayAlpha > 0.8);
});

test('getPlaybackFrameState honors custom transitionDuration and per-verse transitionOut override', () => {
  const customVerses: VerseItem[] = [
    { ...sampleVerses[0], duration: 4, transitionOut: 'slide-up' },
    sampleVerses[1],
  ];
  const { segments } = computeTimelineSegments(customVerses);

  // At 3.4s with 1.2s transition duration => 0.6s remaining => exact midpoint (0.5)
  const midFrame = getPlaybackFrameState(segments, 3.4, 6, true, 0, 1.2, 'crossfade');
  assert.ok(midFrame);
  assert.equal(midFrame.transitionStyle, 'slide-up');
  assert.ok(Math.abs(midFrame.sceneBlend - 0.5) < 0.001);

  // At 3.2s => early cubic ease-in (smooth ramp > 0 and < 0.25)
  const earlyFrame = getPlaybackFrameState(segments, 3.2, 6, true, 0, 1.2, 'crossfade');
  assert.ok(earlyFrame);
  assert.ok(earlyFrame.sceneBlend > 0.1 && earlyFrame.sceneBlend < 0.25);
});

test('toArabicIndicNumerals, line-reveal, and trilingual SRT behave accurately', () => {
  assert.equal(toArabicIndicNumerals(1), '١');
  assert.equal(toArabicIndicNumerals(255), '٢٥٥');
  assert.equal(toArabicIndicNumerals(0), '٠');

  assert.equal(
    computeWordRevealCount('À côté de la difficulté est une facilité', 0.2, 'line-reveal'),
    8
  );

  const srtTri = generateSrtSubtitles(sampleVerses, 'ar-fr-en');
  assert.ok(srtTri.includes(sampleVerses[0].arabic));
  assert.ok(srtTri.includes(sampleVerses[0].french));
  assert.ok(srtTri.includes(sampleVerses[0].english));
});

test('expandVersesForMemorization and dynamic-focus context work cleanly', () => {
  const repeated = expandVersesForMemorization(sampleVerses, 3);
  assert.equal(repeated.length, 6);
  assert.equal(repeated[0].repeatPass, 1);
  assert.equal(repeated[1].repeatPass, 2);
  assert.equal(repeated[2].repeatPass, 3);
  assert.equal(repeated[0].ayahNumber, repeated[2].ayahNumber);

  const { segments } = computeTimelineSegments(sampleVerses);
  const firstFrame = getPlaybackFrameState(segments, 1.0, 5, false, 0);
  assert.equal(firstFrame?.prevArabic, undefined);
  assert.equal(firstFrame?.nextArabic, sampleVerses[1].arabic);

  const secondFrame = getPlaybackFrameState(segments, 5.0, 5, false, 0);
  assert.equal(secondFrame?.prevArabic, sampleVerses[0].arabic);
  assert.equal(secondFrame?.nextArabic, undefined);

  assert.equal(computeWordRevealCount('فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', 0.3, 'mask-reveal'), 4);
  assert.equal(computeWordRevealCount('فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', 0.3, 'dynamic-focus'), 4);
});
