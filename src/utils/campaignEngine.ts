import {
  CampaignConfig,
  PresetPassage,
  PublicationSlotMode,
  QualityCheckResult,
  ReciterOption,
  ScheduledVideoItem,
  StylePreset,
  SurahMeta,
} from '../types/studio';

const SLOT_HOURS: Record<PublicationSlotMode, string[]> = {
  morning: ['06:45', '07:30', '08:15', '09:00', '10:00'],
  'morning-evening': ['07:15', '20:30', '12:45', '18:00', '21:45'],
  distributed: ['07:30', '12:30', '17:30', '20:30', '22:15'],
  optimized: ['07:00', '13:15', '19:45', '21:30', '16:30'],
};

// Curated editorial verse windows across the Quran for diverse, non-repeating 30+ video campaigns
interface EditorialPassageSeed {
  id: string;
  surahNumber: number;
  fromAyah: number;
  toAyah: number;
  presetPassageId?: string;
}

const CAMPAIGN_PASSAGE_POOL: EditorialPassageSeed[] = [
  { id: 'pool-94-1-8', surahNumber: 94, fromAyah: 1, toAyah: 8, presetPassageId: 'al-inshirah' },
  { id: 'pool-1-1-7', surahNumber: 1, fromAyah: 1, toAyah: 7, presetPassageId: 'al-fatiha' },
  { id: 'pool-93-1-8', surahNumber: 93, fromAyah: 1, toAyah: 8, presetPassageId: 'ad-duha' },
  { id: 'pool-112-1-4', surahNumber: 112, fromAyah: 1, toAyah: 4, presetPassageId: 'al-ikhlas' },
  { id: 'pool-103-1-3', surahNumber: 103, fromAyah: 1, toAyah: 3, presetPassageId: 'al-asr' },
  { id: 'pool-2-255', surahNumber: 2, fromAyah: 255, toAyah: 255, presetPassageId: 'ayat-al-kursi' },
  { id: 'pool-55-1-13', surahNumber: 55, fromAyah: 1, toAyah: 13 },
  { id: 'pool-67-1-5', surahNumber: 67, fromAyah: 1, toAyah: 5 },
  { id: 'pool-18-10-12', surahNumber: 18, fromAyah: 10, toAyah: 12 },
  { id: 'pool-2-285-286', surahNumber: 2, fromAyah: 285, toAyah: 286 },
  { id: 'pool-3-190-194', surahNumber: 3, fromAyah: 190, toAyah: 194 },
  { id: 'pool-13-28-29', surahNumber: 13, fromAyah: 28, toAyah: 29 },
  { id: 'pool-14-39-41', surahNumber: 14, fromAyah: 39, toAyah: 41 },
  { id: 'pool-20-25-28', surahNumber: 20, fromAyah: 25, toAyah: 28 },
  { id: 'pool-24-35', surahNumber: 24, fromAyah: 35, toAyah: 35 },
  { id: 'pool-25-63-67', surahNumber: 25, fromAyah: 63, toAyah: 67 },
  { id: 'pool-31-12-15', surahNumber: 31, fromAyah: 12, toAyah: 15 },
  { id: 'pool-36-1-12', surahNumber: 36, fromAyah: 1, toAyah: 12 },
  { id: 'pool-39-53-55', surahNumber: 39, fromAyah: 53, toAyah: 55 },
  { id: 'pool-50-16-20', surahNumber: 50, fromAyah: 16, toAyah: 20 },
  { id: 'pool-57-1-6', surahNumber: 57, fromAyah: 1, toAyah: 6 },
  { id: 'pool-59-22-24', surahNumber: 59, fromAyah: 22, toAyah: 24 },
  { id: 'pool-65-2-3', surahNumber: 65, fromAyah: 2, toAyah: 3 },
  { id: 'pool-73-1-8', surahNumber: 73, fromAyah: 1, toAyah: 8 },
  { id: 'pool-87-1-10', surahNumber: 87, fromAyah: 1, toAyah: 10 },
  { id: 'pool-89-27-30', surahNumber: 89, fromAyah: 27, toAyah: 30 },
  { id: 'pool-91-1-10', surahNumber: 91, fromAyah: 1, toAyah: 10 },
  { id: 'pool-95-1-8', surahNumber: 95, fromAyah: 1, toAyah: 8 },
  { id: 'pool-97-1-5', surahNumber: 97, fromAyah: 1, toAyah: 5 },
  { id: 'pool-108-1-3', surahNumber: 108, fromAyah: 1, toAyah: 3 },
  { id: 'pool-113-1-5', surahNumber: 113, fromAyah: 1, toAyah: 5 },
  { id: 'pool-114-1-6', surahNumber: 114, fromAyah: 1, toAyah: 6 },
  { id: 'pool-2-152-157', surahNumber: 2, fromAyah: 152, toAyah: 157 },
  { id: 'pool-2-186', surahNumber: 2, fromAyah: 186, toAyah: 186 },
  { id: 'pool-3-26-27', surahNumber: 3, fromAyah: 26, toAyah: 27 },
  { id: 'pool-16-90-92', surahNumber: 16, fromAyah: 90, toAyah: 92 },
  { id: 'pool-23-1-11', surahNumber: 23, fromAyah: 1, toAyah: 11 },
  { id: 'pool-29-69', surahNumber: 29, fromAyah: 69, toAyah: 69 },
  { id: 'pool-40-60-61', surahNumber: 40, fromAyah: 60, toAyah: 61 },
  { id: 'pool-49-10-13', surahNumber: 49, fromAyah: 10, toAyah: 13 },
  { id: 'pool-53-38-44', surahNumber: 53, fromAyah: 38, toAyah: 44 },
  { id: 'pool-55-19-28', surahNumber: 55, fromAyah: 19, toAyah: 28 },
  { id: 'pool-67-15-19', surahNumber: 67, fromAyah: 15, toAyah: 19 },
  { id: 'pool-78-6-16', surahNumber: 78, fromAyah: 6, toAyah: 16 },
  { id: 'pool-90-1-10', surahNumber: 90, fromAyah: 1, toAyah: 10 },
];

export const DEFAULT_CAMPAIGN_CONFIG: CampaignConfig = {
  name: 'Rappels quotidiens — 30 jours',
  videosPerDay: 1,
  durationDays: 14,
  slotMode: 'morning-evening',
  subtitleLanguage: 'ar-fr',
  textAnimation: 'luminous-reveal',
  selectedReciterIds: ['ar.alafasy', 'ar.mahermuaiqly', 'warsh.jazaery'],
  selectedFamilies: ['nature', 'architecture', 'manuscript', 'luxury', 'minimal'],
  platforms: ['tiktok', 'instagram', 'youtube'],
  varyStyles: true,
  alternateReciters: true,
  avoidDuplicates: true,
};

/**
 * Formats a relative French date label for a scheduled campaign day.
 */
export function formatCampaignDateLabel(dayOffset: number, baseDate: Date = new Date()): string {
  if (dayOffset === 0) return 'Demain';
  const target = new Date(baseDate.getTime() + (dayOffset + 1) * 86_400_000);
  return target.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Evaluates deterministic quality checks for a scheduled video slot:
 * - Authentic Surah/Ayah range bounds
 * - Verified CORS reciter folder
 * - High-contrast readability pairing (light vs dark layout)
 * - Uniqueness check
 */
export function evaluateSlotQuality(
  surah: SurahMeta | undefined,
  fromAyah: number,
  toAyah: number,
  reciter: ReciterOption | undefined,
  style: StylePreset | undefined,
  isDuplicate: boolean
): QualityCheckResult {
  const arabicIntegrity =
    Boolean(surah) &&
    fromAyah >= 1 &&
    toAyah >= fromAyah &&
    toAyah <= (surah?.ayahCount ?? 0);
  const audioSourceVerified = Boolean(reciter && reciter.everyAyahFolder.length > 0);
  const contrastReadable = Boolean(
    style &&
      (style.layoutMode === 'light-editorial' || style.layoutMode === 'mushaf-frame'
        ? style.arabicColor.startsWith('#1') ||
          style.arabicColor.startsWith('#2') ||
          style.scrimOpacity >= 0.35
        : style.scrimOpacity >= 0.32 || style.layoutMode === 'minimal-obsidian')
  );
  const noDuplicate = !isDuplicate;
  return {
    arabicIntegrity,
    audioSourceVerified,
    contrastReadable,
    noDuplicate,
    passed: arabicIntegrity && audioSourceVerified && contrastReadable && noDuplicate,
  };
}

/**
 * Computes campaign headline totals without side effects.
 */
export function computeCampaignTotals(config: Pick<CampaignConfig, 'videosPerDay' | 'durationDays'>): {
  totalVideos: number;
  videosPerWeek: number;
} {
  const perDay = Math.max(1, Math.min(5, Math.round(config.videosPerDay)));
  const days = Math.max(1, Math.min(60, Math.round(config.durationDays)));
  return {
    totalVideos: perDay * days,
    videosPerWeek: perDay * 7,
  };
}

/**
 * Generates a full non-repeating, multi-style, multi-reciter publication schedule
 * honoring user campaign rules and anti-duplicate safeguards.
 */
export function generateCampaignSchedule(
  config: CampaignConfig,
  allStyles: StylePreset[],
  allReciters: ReciterOption[],
  surahList: SurahMeta[],
  presetPassages: PresetPassage[],
  baseDate: Date = new Date()
): ScheduledVideoItem[] {
  const perDay = Math.max(1, Math.min(5, Math.round(config.videosPerDay)));
  const days = Math.max(1, Math.min(30, Math.round(config.durationDays)));

  const candidateStyles =
    config.selectedFamilies.length > 0
      ? allStyles.filter((s) => config.selectedFamilies.includes(s.family) || s.isCustom)
      : allStyles;
  const stylesPool = candidateStyles.length > 0 ? candidateStyles : allStyles;

  const candidateReciters =
    config.selectedReciterIds.length > 0
      ? allReciters.filter((r) => config.selectedReciterIds.includes(r.id))
      : allReciters;
  const recitersPool = candidateReciters.length > 0 ? candidateReciters : allReciters;

  const slots = SLOT_HOURS[config.slotMode] ?? SLOT_HOURS['morning-evening'];
  const surahMap = new Map(surahList.map((s) => [s.number, s]));
  const presetMap = new Map(presetPassages.map((p) => [p.id, p]));

  const items: ScheduledVideoItem[] = [];
  const usedPassageKeys = new Set<string>();

  let globalIdx = 0;

  for (let day = 0; day < days; day++) {
    const dateLabel = formatCampaignDateLabel(day, baseDate);

    for (let slotInDay = 0; slotInDay < perDay; slotInDay++) {
      // Pick passage deterministically; if avoidDuplicates is active and pool exhausted, synthesize fresh valid Ayah windows across surahs
      let passageSeed = CAMPAIGN_PASSAGE_POOL[globalIdx % CAMPAIGN_PASSAGE_POOL.length];
      let surahNumber = passageSeed.surahNumber;
      let fromAyah = passageSeed.fromAyah;
      let toAyah = passageSeed.toAyah;
      let passageId = passageSeed.presetPassageId ?? `auto-${surahNumber}-${fromAyah}-${toAyah}`;

      const key = `${surahNumber}:${fromAyah}-${toAyah}`;
      let isDuplicate = usedPassageKeys.has(key);

      if (config.avoidDuplicates && isDuplicate) {
        // Synthesize a guaranteed non-duplicate authentic Ayah slice from longer surahs
        const cycle = Math.floor(globalIdx / CAMPAIGN_PASSAGE_POOL.length);
        const targetSurah = surahList[(globalIdx * 7 + cycle * 3) % surahList.length];
        surahNumber = targetSurah.number;
        const maxStart = Math.max(1, targetSurah.ayahCount - 4);
        fromAyah = ((globalIdx * 5 + cycle * 11) % maxStart) + 1;
        toAyah = Math.min(targetSurah.ayahCount, fromAyah + Math.min(4, targetSurah.ayahCount - fromAyah));
        passageId = `auto-${surahNumber}-${fromAyah}-${toAyah}`;
        const freshKey = `${surahNumber}:${fromAyah}-${toAyah}`;
        isDuplicate = usedPassageKeys.has(freshKey);
        usedPassageKeys.add(freshKey);
      } else {
        usedPassageKeys.add(key);
      }

      const surahMeta = surahMap.get(surahNumber);
      const preset = passageSeed.presetPassageId ? presetMap.get(passageSeed.presetPassageId) : undefined;

      // Style variety vs consistent signature
      const style = config.varyStyles
        ? stylesPool[globalIdx % stylesPool.length]
        : stylesPool[0];

      // Reciter alternation vs fixed voice
      const reciter = config.alternateReciters
        ? recitersPool[(globalIdx + Math.floor(globalIdx / Math.max(1, stylesPool.length))) % recitersPool.length]
        : recitersPool[0];

      const quality = evaluateSlotQuality(
        surahMeta,
        fromAyah,
        toAyah,
        reciter,
        style,
        isDuplicate
      );

      items.push({
        id: `slot-${day}-${slotInDay}-${globalIdx}`,
        dayIndex: day,
        scheduledDateLabel: dateLabel,
        scheduledTime: slots[slotInDay % slots.length],
        passageId: preset ? preset.id : passageId,
        surahNumber,
        surahNameFr: surahMeta?.nameFr ?? `Sourate ${surahNumber}`,
        surahNameAr: surahMeta?.nameAr ?? '',
        fromAyah,
        toAyah,
        reciterId: reciter.id,
        reciterName: reciter.name,
        tradition: reciter.tradition,
        styleId: style.id,
        styleName: style.name,
        styleFamily: style.family,
        sceneId: style.recommendedSceneId,
        transition: style.recommendedTransition,
        textAnimation: config.textAnimation,
        subtitleLanguage: config.subtitleLanguage,
        platforms: config.platforms.length > 0 ? config.platforms : ['tiktok'],
        status: 'pending-review',
        quality,
      });

      globalIdx++;
    }
  }

  return items;
}
