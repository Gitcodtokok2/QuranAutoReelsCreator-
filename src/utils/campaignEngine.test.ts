import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCampaignTotals,
  DEFAULT_CAMPAIGN_CONFIG,
  generateCampaignSchedule,
} from './campaignEngine';
import {
  PRESET_PASSAGES,
  RECITERS,
  STYLE_PRESETS,
  SURAH_LIST,
} from '../data/quranLibrary';

test('computeCampaignTotals accurately multiplies videos/day by campaign days and weekly cadence', () => {
  const res = computeCampaignTotals({ videosPerDay: 3, durationDays: 30 });
  assert.equal(res.totalVideos, 90);
  assert.equal(res.videosPerWeek, 21);

  const clamped = computeCampaignTotals({ videosPerDay: 0, durationDays: 7 });
  assert.equal(clamped.totalVideos, 7);
  assert.equal(clamped.videosPerWeek, 7);
});

test('generateCampaignSchedule produces exact count, zero duplicates, varied styles, and alternating reciters', () => {
  const config = {
    ...DEFAULT_CAMPAIGN_CONFIG,
    videosPerDay: 2,
    durationDays: 15, // 30 videos total
    selectedReciterIds: ['ar.alafasy', 'warsh.jazaery', 'ar.mahermuaiqly'],
    varyStyles: true,
    alternateReciters: true,
    avoidDuplicates: true,
  };

  const items = generateCampaignSchedule(
    config,
    STYLE_PRESETS,
    RECITERS,
    SURAH_LIST,
    PRESET_PASSAGES,
    new Date('2026-11-25T10:00:00Z')
  );

  assert.equal(items.length, 30);

  // Every slot passes quality control & has zero duplicate Surah:from-to pairs
  const keys = new Set<string>();
  for (const item of items) {
    assert.equal(item.quality.passed, true);
    const key = `${item.surahNumber}:${item.fromAyah}-${item.toAyah}`;
    assert.ok(!keys.has(key), `Duplicate passage generated: ${key}`);
    keys.add(key);
  }

  // Styles and reciters vary across consecutive videos
  assert.notEqual(items[0].styleId, items[1].styleId);
  assert.notEqual(items[0].reciterId, items[1].reciterId);

  // Includes Warsh tradition when selected
  assert.ok(items.some((i) => i.tradition === 'Warsh'));
});

test('generateCampaignSchedule handles large 90-video campaigns without breaking quality or bounds', () => {
  const config = {
    ...DEFAULT_CAMPAIGN_CONFIG,
    videosPerDay: 3,
    durationDays: 30,
    avoidDuplicates: true,
  };

  const items = generateCampaignSchedule(
    config,
    STYLE_PRESETS,
    RECITERS,
    SURAH_LIST,
    PRESET_PASSAGES,
    new Date('2026-11-25T10:00:00Z')
  );

  assert.equal(items.length, 90);
  for (const item of items) {
    const surah = SURAH_LIST.find((s) => s.number === item.surahNumber);
    assert.ok(surah);
    assert.ok(item.fromAyah >= 1 && item.toAyah <= surah.ayahCount);
    assert.ok(item.quality.arabicIntegrity);
    assert.ok(item.quality.audioSourceVerified);
  }
});
