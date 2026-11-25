export type WorkspaceModule = 'studio' | 'library' | 'automation';

export type StudioTab = 'passages' | 'visuals' | 'typography' | 'sequences';

export type SubtitleLanguage = 'ar-fr' | 'ar-en' | 'ar-fr-en' | 'ar-only' | 'fr-only';

export type TextAnimationStyle =
  | 'karaoke'
  | 'luminous-reveal'
  | 'line-reveal'
  | 'dynamic-focus'
  | 'mask-reveal'
  | 'mushaf-page'
  | 'cinematic-fade'
  | 'vertical-rise';

export type ParticleEffect = 'gold-dust' | 'gentle-rain' | 'starlight' | 'soft-mist' | 'none';

export type TranslationFontFamily = 'editorial' | 'modern';

export type ArabicFontFamily = 'amiri' | 'scheherazade' | 'noto-naskh' | 'lateef';

export type MemorizationRepeat = 1 | 2 | 3;

export type ExportResolution = '720p' | '1080p' | '4k';

export type RecitationTradition = 'Hafs' | 'Warsh';

export type StyleFamily =
  | 'nature'
  | 'architecture'
  | 'manuscript'
  | 'luxury'
  | 'minimal'
  | 'astronomy'
  | 'meditation'
  | 'education'
  | 'watercolor'
  | 'abstract-glass'
  | 'calligraphy'
  | 'ramadan';

export type StyleLayoutMode =
  | 'cinematic-center'
  | 'light-editorial'
  | 'mushaf-frame'
  | 'minimal-obsidian'
  | 'editorial-bottom'
  | 'study-focus';

export type EditorialThemeId =
  | 'patience'
  | 'misericorde'
  | 'creation'
  | 'gratitude'
  | 'espoir'
  | 'invocation'
  | 'contemplation'
  | 'apprentissage';

export type SceneAnimationLayer =
  | 'rain-glass'
  | 'celestial-dunes'
  | 'moonlit-ocean'
  | 'forest-sunbeams'
  | 'lantern-glow'
  | 'sacred-nebula'
  | 'none';

export type SceneTransitionStyle =
  | 'crossfade'
  | 'slow-zoom'
  | 'slide-up'
  | 'cinematic-blur'
  | 'golden-flash'
  | 'dip-black';

export interface SceneTransitionPreset {
  id: SceneTransitionStyle;
  shortLabel: string;
  name: string;
  description: string;
  group: 'primary' | 'advanced';
}

export type AudioSyncStatus = 'idle' | 'syncing' | 'synced' | 'fallback';

export interface VerseItem {
  id: string;
  surahNumber: number;
  surahNameFr: string;
  surahNameAr: string;
  ayahNumber: number;
  globalAyahNumber: number;
  arabic: string;
  french: string;
  english: string;
  duration: number; // in seconds
  transitionOut?: SceneTransitionStyle;
  repeatPass?: number; // 1-based pass number when memorizationRepeat > 1
}

export interface PresetPassage {
  id: string;
  title: string;
  surahNumber: number;
  surahNameAr: string;
  rangeLabel: string;
  themeNote: string;
  editorialTheme: EditorialThemeId;
  verses: VerseItem[];
}

export interface SceneAsset {
  id: string;
  name: string;
  mood: string;
  family: StyleFamily;
  type: 'image' | 'video' | 'generative';
  url: string;
  animationLayer: SceneAnimationLayer;
  fallbackGradient: [string, string, string];
  isLightSurface?: boolean;
  isCustom?: boolean;
}

export interface ReciterOption {
  id: string;
  name: string;
  style: string;
  tradition: RecitationTradition;
  origin: string;
  everyAyahFolder: string;
}

export interface SurahMeta {
  number: number;
  nameFr: string;
  nameAr: string;
  ayahCount: number;
}

export interface ArabicFontOption {
  id: ArabicFontFamily;
  label: string;
  cssFamily: string;
  styleNote: string;
}

export interface StylePreset {
  id: string;
  name: string;
  family: StyleFamily;
  layoutMode: StyleLayoutMode;
  description: string;
  recommendedSceneId: string;
  recommendedTransition: SceneTransitionStyle;
  arabicColor: string;
  translationColor: string;
  accentColor: string;
  scrimOpacity: number;
  particleEffect: ParticleEffect;
  textAnimation: TextAnimationStyle;
  translationFont: TranslationFontFamily;
  arabicFont?: ArabicFontFamily;
  arabicFontSize?: number;
  translationFontSize?: number;
  verticalPosition?: number;
  showOrnament: boolean;
  showAudioWave: boolean;
  isCustom?: boolean;
}

export interface EditorialMoodSuggestion {
  id: EditorialThemeId;
  label: string;
  atmosphere: string;
  presetId: string;
  sceneId: string;
  transition: SceneTransitionStyle;
}

export interface StudioConfig {
  subtitleLanguage: SubtitleLanguage;
  textAnimation: TextAnimationStyle;
  particleEffect: ParticleEffect;
  translationFont: TranslationFontFamily;
  arabicFont: ArabicFontFamily;
  memorizationRepeat: MemorizationRepeat;
  layoutMode: StyleLayoutMode;
  arabicFontSize: number; // px at 1080w reference scale
  translationFontSize: number; // px at 1080w reference scale
  verticalPosition: number; // 0.35 to 0.65 (fraction of height)
  scrimOpacity: number; // 0.0 to 0.85
  motionIntensity: number; // 0 to 1 (Ken Burns speed/zoom)
  autoCycleScenes: boolean;
  sceneTransition: SceneTransitionStyle;
  transitionDuration: number; // in seconds (0.4..1.8)
  activeSceneId: string;
  arabicColor: string;
  translationColor: string;
  accentColor: string;
  showSurahHeader: boolean;
  showOrnament: boolean;
  showAudioWave: boolean;
  showTikTokSafeZone: boolean;
  watermark: string;
  reciterId: string;
  audioEnabled: boolean;
  activePresetId: string;
}

export interface TimelineSegment {
  index: number;
  verse: VerseItem;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface PlaybackFrameState {
  activeIndex: number;
  activeSegment: TimelineSegment;
  prevArabic?: string;
  nextArabic?: string;
  verseElapsed: number;
  verseProgress: number; // 0..1
  fadeFactor: number; // 0..1 opacity envelope
  sceneIndex: number;
  nextSceneIndex: number;
  sceneBlend: number; // 0..1 crossfade blend towards next scene
  transitionStyle: SceneTransitionStyle;
  totalDuration: number;
}

// Automation & Campaign Engine Types
export type PublicationSlotMode = 'morning' | 'morning-evening' | 'distributed' | 'optimized';

export type SocialPlatformId = 'tiktok' | 'instagram' | 'youtube' | 'facebook';

export type ScheduledItemStatus = 'pending-review' | 'approved' | 'exported';

export interface CampaignConfig {
  name: string;
  videosPerDay: number; // 1..5
  durationDays: number; // 7..30
  slotMode: PublicationSlotMode;
  subtitleLanguage: SubtitleLanguage;
  textAnimation: TextAnimationStyle;
  selectedReciterIds: string[];
  selectedFamilies: StyleFamily[];
  platforms: SocialPlatformId[];
  varyStyles: boolean;
  alternateReciters: boolean;
  avoidDuplicates: boolean;
}

export interface QualityCheckResult {
  arabicIntegrity: boolean;
  audioSourceVerified: boolean;
  contrastReadable: boolean;
  noDuplicate: boolean;
  passed: boolean;
}

export interface ScheduledVideoItem {
  id: string;
  dayIndex: number; // 0-based
  scheduledDateLabel: string;
  scheduledTime: string;
  passageId: string;
  surahNumber: number;
  surahNameFr: string;
  surahNameAr: string;
  fromAyah: number;
  toAyah: number;
  reciterId: string;
  reciterName: string;
  tradition: RecitationTradition;
  styleId: string;
  styleName: string;
  styleFamily: StyleFamily;
  sceneId: string;
  transition: SceneTransitionStyle;
  textAnimation: TextAnimationStyle;
  subtitleLanguage: SubtitleLanguage;
  platforms: SocialPlatformId[];
  status: ScheduledItemStatus;
  quality: QualityCheckResult;
  caption?: string;
  hashtags?: string[];
}

export interface ExportHistoryItem {
  id: string;
  exportedAt: string;
  surahLabel: string;
  reciterName: string;
  styleName: string;
  resolution: ExportResolution | 'SRT';
  format: 'video' | 'srt';
  durationSec: number;
}
