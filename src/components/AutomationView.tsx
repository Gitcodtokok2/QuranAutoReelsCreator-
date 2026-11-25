import { FormEvent, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  PRESET_PASSAGES,
  RECITERS,
  STYLE_FAMILIES,
  STYLE_PRESETS,
  SURAH_LIST,
} from '../data/quranLibrary';
import {
  CampaignConfig,
  ExportHistoryItem,
  PublicationSlotMode,
  ScheduledVideoItem,
  SocialPlatformId,
  StyleFamily,
  StylePreset,
  SubtitleLanguage,
  TextAnimationStyle,
} from '../types/studio';
import {
  computeCampaignTotals,
  generateCampaignSchedule,
} from '../utils/campaignEngine';

type AutomationTab = 'calendar' | 'queue' | 'history' | 'platforms';

interface AutomationViewProps {
  campaignConfig: CampaignConfig;
  schedule: ScheduledVideoItem[];
  customStyles: StylePreset[];
  exportHistory: ExportHistoryItem[];
  isLoadingSlotId: string | null;
  onUpdateCampaignConfig: (patch: Partial<CampaignConfig>) => void;
  onReplaceSchedule: (items: ScheduledVideoItem[]) => void;
  onToggleApproveSlot: (slotId: string) => void;
  onApproveAllPending: () => void;
  onUpdateSlotCaption: (slotId: string, caption: string, hashtags: string[]) => void;
  onOpenSlotInStudio: (slot: ScheduledVideoItem) => void;
}

const SLOT_MODES: { id: PublicationSlotMode; label: string }[] = [
  { id: 'morning', label: 'Matin (Fajr & matinée)' },
  { id: 'morning-evening', label: 'Matin et soir' },
  { id: 'distributed', label: 'Répartis sur la journée' },
  { id: 'optimized', label: 'Horaires optimisés' },
];

const PLATFORM_META: {
  id: SocialPlatformId;
  label: string;
  spec: string;
  policyNote: string;
}[] = [
  {
    id: 'tiktok',
    label: 'TikTok',
    spec: '9:16 · 1080×1920 ou 4K · Content Posting API',
    policyNote:
      'Validation explicite du créateur requise avant publication ou envoi en brouillon (conforme aux directives TikTok).',
  },
  {
    id: 'instagram',
    label: 'Instagram Reels',
    spec: '9:16 · 1080×1920 · Audio AAC/Opus',
    policyNote:
      'Export prêt à programmer via Meta Business Suite avec légende et hashtags générés.',
  },
  {
    id: 'youtube',
    label: 'YouTube Shorts',
    spec: '9:16 · Sous-titres .SRT disponibles',
    policyNote:
      'Compatible YouTube Studio avec fichier sous-titres synchronisés pour l’accessibilité.',
  },
  {
    id: 'facebook',
    label: 'Facebook Reels',
    spec: '9:16 · Format haute lisibilité',
    policyNote:
      'Publication programmée après vérification de la qualité typographique et audio.',
  },
];

const AI_EXAMPLE_PROMPTS = [
  '1 vidéo par jour à 7h et 20h pendant 14 jours, arabe + français, styles variés, récitateurs Hafs et Warsh',
  '2 vidéos par jour pendant 7 jours pour la mémorisation, karaoké trilingue, style papier clair et Mushaf',
  '1 rappel apaisant chaque matin pendant 30 jours, nature et architecture, sans jamais répéter un verset',
];

const LANGUAGE_LABELS: Record<SubtitleLanguage, string> = {
  'ar-fr': 'Arabe + FR',
  'ar-en': 'Arabe + EN',
  'ar-fr-en': 'Trilingue (AR+FR+EN)',
  'ar-only': 'Arabe seul',
  'fr-only': 'FR seul',
};

const ANIMATION_LABELS: Record<TextAnimationStyle, string> = {
  karaoke: 'Karaoké lumineux',
  'luminous-reveal': 'Mot par mot',
  'line-reveal': 'Ligne par ligne',
  'dynamic-focus': 'Focus dynamique',
  'mask-reveal': 'Révélation par masque',
  'mushaf-page': 'Page de Mushaf',
  'cinematic-fade': 'Fondu cinématique',
  'vertical-rise': 'Défilement ascendant',
};

const PRODUCTION_CYCLE_STEPS = [
  '1. Sélection du contenu (sourate, versets, récitateur, thème)',
  '2. Composition multicouche (style, fond, typographie, animations)',
  '3. Synchronisation audio continue (sans coupure ni silence mort)',
  '4. Contrôle qualité 4 points (Uthmani, audio, contraste, anti-doublon)',
  '5. Rendu vidéo 9:16 (HD / Full HD / 4K + sous-titres .SRT)',
  '6. Validation explicite du créateur et génération des légendes IA',
];

export function AutomationView({
  campaignConfig,
  schedule,
  customStyles,
  exportHistory,
  isLoadingSlotId,
  onUpdateCampaignConfig,
  onReplaceSchedule,
  onToggleApproveSlot,
  onApproveAllPending,
  onUpdateSlotCaption,
  onOpenSlotInStudio,
}: AutomationViewProps) {
  const [activeTab, setActiveTab] = useState<AutomationTab>('calendar');
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending-review' | 'approved'>('all');

  // AI campaign assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Per-slot AI caption state
  const [captionLoadingId, setCaptionLoadingId] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const allStyles = useMemo(
    () => [...customStyles, ...STYLE_PRESETS],
    [customStyles]
  );

  const totals = useMemo(
    () => computeCampaignTotals(campaignConfig),
    [campaignConfig]
  );

  const qualityPassedCount = useMemo(
    () => schedule.filter((item) => item.quality.passed).length,
    [schedule]
  );

  const approvedCount = useMemo(
    () => schedule.filter((item) => item.status === 'approved').length,
    [schedule]
  );

  const handleRegenerateSchedule = (overrideConfig?: CampaignConfig) => {
    const cfg = overrideConfig ?? campaignConfig;
    const generated = generateCampaignSchedule(
      cfg,
      allStyles,
      RECITERS,
      SURAH_LIST,
      PRESET_PASSAGES
    );
    onReplaceSchedule(generated);
  };

  const handleAiPlanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = aiPrompt.trim();
    if (!cleaned || aiLoading) return;

    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);

    try {
      const response = await fetch('/api/ai/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleaned }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Impossible de générer la campagne.');
      }

      const validReciterIds = new Set(RECITERS.map((r) => r.id));
      const validFamilies = new Set<StyleFamily>(STYLE_FAMILIES.map((f) => f.id));
      const validSlotModes = new Set<PublicationSlotMode>(SLOT_MODES.map((m) => m.id));
      const validLanguages = new Set<SubtitleLanguage>(
        Object.keys(LANGUAGE_LABELS) as SubtitleLanguage[]
      );
      const validAnimations = new Set<TextAnimationStyle>(
        Object.keys(ANIMATION_LABELS) as TextAnimationStyle[]
      );

      const parsedReciters = Array.isArray(data.selectedReciterIds)
        ? data.selectedReciterIds.filter(
            (id: unknown): id is string =>
              typeof id === 'string' && validReciterIds.has(id)
          )
        : [];

      const parsedFamilies = Array.isArray(data.selectedFamilies)
        ? data.selectedFamilies.filter(
            (fam: unknown): fam is StyleFamily =>
              typeof fam === 'string' && validFamilies.has(fam as StyleFamily)
          )
        : [];

      const clampedPerDay = Math.max(
        1,
        Math.min(5, Math.round(Number(data.videosPerDay) || campaignConfig.videosPerDay))
      );
      const clampedDays = Math.max(
        7,
        Math.min(30, Math.round(Number(data.durationDays) || campaignConfig.durationDays))
      );

      const nextConfig: CampaignConfig = {
        ...campaignConfig,
        name:
          (typeof data.campaignName === 'string' && data.campaignName.trim()) ||
          (typeof data.name === 'string' && data.name.trim()) ||
          campaignConfig.name,
        videosPerDay: clampedPerDay,
        durationDays: clampedDays,
        slotMode: validSlotModes.has(data.slotMode)
          ? data.slotMode
          : campaignConfig.slotMode,
        subtitleLanguage: validLanguages.has(data.subtitleLanguage)
          ? data.subtitleLanguage
          : campaignConfig.subtitleLanguage,
        textAnimation: validAnimations.has(data.textAnimation)
          ? data.textAnimation
          : campaignConfig.textAnimation,
        selectedFamilies:
          parsedFamilies.length > 0
            ? parsedFamilies
            : campaignConfig.selectedFamilies,
        selectedReciterIds:
          parsedReciters.length > 0
            ? parsedReciters
            : campaignConfig.selectedReciterIds,
        varyStyles:
          typeof data.varyStyles === 'boolean'
            ? data.varyStyles
            : campaignConfig.varyStyles,
        alternateReciters:
          typeof data.alternateReciters === 'boolean'
            ? data.alternateReciters
            : campaignConfig.alternateReciters,
        avoidDuplicates:
          typeof data.avoidDuplicates === 'boolean'
            ? data.avoidDuplicates
            : true,
      };

      onUpdateCampaignConfig(nextConfig);
      handleRegenerateSchedule(nextConfig);
      setAiSummary(
        (typeof data.directorNote === 'string' && data.directorNote.trim()) ||
          `Campagne « ${nextConfig.name} » configurée et calendrier actualisé.`
      );
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'L’assistant IA est momentanément indisponible. Vous pouvez configurer la campagne manuellement ci-dessous.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateCaption = async (slot: ScheduledVideoItem) => {
    setCaptionError(null);
    setCaptionLoadingId(slot.id);
    try {
      const response = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surahNameFr: slot.surahNameFr,
          surahNumber: slot.surahNumber,
          fromAyah: slot.fromAyah,
          toAyah: slot.toAyah,
          reciterName: slot.reciterName,
          tradition: slot.tradition,
          styleName: slot.styleName,
          language: slot.subtitleLanguage,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Échec de génération de la légende.');
      }
      onUpdateSlotCaption(
        slot.id,
        String(data.caption || ''),
        Array.isArray(data.hashtags) ? data.hashtags.map(String) : []
      );
    } catch (err) {
      setCaptionError(
        err instanceof Error
          ? err.message
          : 'Impossible de générer la légende pour cette vidéo.'
      );
    } finally {
      setCaptionLoadingId(null);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCampaignSummary = () => {
    const summary = [
      `Campagne NoorReel : ${campaignConfig.name}`,
      `Rythme : ${campaignConfig.videosPerDay} vidéo(s)/jour pendant ${campaignConfig.durationDays} jours (${totals.totalVideos} vidéos)`,
      `Langue : ${LANGUAGE_LABELS[campaignConfig.subtitleLanguage]} | Animation : ${ANIMATION_LABELS[campaignConfig.textAnimation]}`,
      `Récitateurs (${campaignConfig.selectedReciterIds.length}) : ${RECITERS.filter((r) => campaignConfig.selectedReciterIds.includes(r.id)).map((r) => `${r.name} (${r.tradition})`).join(', ')}`,
      `Validées : ${approvedCount}/${schedule.length}`,
    ].join('\n');
    navigator.clipboard?.writeText(summary).catch(() => {});
    setCopiedSummary(true);
    window.setTimeout(() => setCopiedSummary(false), 2000);
  };

  const toggleReciter = (id: string) => {
    const current = campaignConfig.selectedReciterIds;
    const exists = current.includes(id);
    if (exists && current.length <= 1) return;
    onUpdateCampaignConfig({
      selectedReciterIds: exists
        ? current.filter((item) => item !== id)
        : [...current, id],
    });
  };

  const toggleFamily = (family: StyleFamily) => {
    const current = campaignConfig.selectedFamilies;
    const exists = current.includes(family);
    if (exists && current.length <= 1) return;
    onUpdateCampaignConfig({
      selectedFamilies: exists
        ? current.filter((item) => item !== family)
        : [...current, family],
    });
  };

  const togglePlatform = (platform: SocialPlatformId) => {
    const current = campaignConfig.platforms;
    const exists = current.includes(platform);
    if (exists && current.length <= 1) return;
    onUpdateCampaignConfig({
      platforms: exists
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    });
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<number, { label: string; items: ScheduledVideoItem[] }>();
    for (const item of schedule) {
      const existing = map.get(item.dayIndex);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.dayIndex, { label: item.scheduledDateLabel, items: [item] });
      }
    }
    return Array.from(map.entries());
  }, [schedule]);

  const filteredQueue = useMemo(() => {
    if (queueFilter === 'all') return schedule;
    return schedule.filter((item) => item.status === queueFilter);
  }, [schedule, queueFilter]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Top KPI header bar */}
      <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-50">
            Automatisation & Calendrier
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Préparez une série régulière sans doublon, contrôlez chaque verset et ouvrez n’importe quelle vidéo directement dans le Studio.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-4 sm:gap-7">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
              Vidéos planifiées
            </dt>
            <dd className="font-mono-tabular mt-0.5 text-xl font-semibold text-zinc-100">
              {schedule.length}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
              Qualité vérifiée
            </dt>
            <dd className="font-mono-tabular mt-0.5 text-xl font-semibold text-[#D4A853]">
              {qualityPassedCount}/{schedule.length}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-zinc-500">
              Approuvées
            </dt>
            <dd className="font-mono-tabular mt-0.5 text-xl font-semibold text-zinc-100">
              {approvedCount}/{schedule.length}
            </dd>
          </div>
        </dl>
      </div>

      {/* Main 2-column automation grid */}
      <div className="mt-7 grid grid-cols-1 gap-7 lg:grid-cols-12">
        {/* LEFT COLUMN (5 cols): AI Assistant + Campaign Configurator */}
        <div className="space-y-6 lg:col-span-5">
          {/* AI Campaign Prompt Card */}
          <section
            aria-labelledby="ai-campaign-heading"
            className="rounded-xl border border-white/[0.08] bg-[#131318] p-5"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4A853]" aria-hidden="true" />
              <h2
                id="ai-campaign-heading"
                className="text-sm font-semibold text-zinc-100"
              >
                Assistant IA de campagne
              </h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Décrivez votre rythme et votre style en français. L’IA ajuste les paramètres de campagne sans jamais modifier les versets coraniques.
            </p>

            <form onSubmit={handleAiPlanSubmit} className="mt-3.5 space-y-3">
              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ex. Publier 2 vidéos par jour à 7h et 20h pendant 14 jours, arabe + français, styles variés, récitateurs Hafs et Warsh"
                aria-label="Décrire la campagne souhaitée"
                className="w-full resize-none rounded-lg border border-white/[0.1] bg-[#0D0D11] p-3 text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4A853] focus:outline-none"
              />

              <div className="flex flex-wrap gap-1.5">
                {AI_EXAMPLE_PROMPTS.map((example, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAiPrompt(example)}
                    className="rounded-md border border-white/[0.08] bg-[#1A1A22] px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-[#D4A853]/45 hover:text-zinc-100 cursor-pointer text-left"
                  >
                    Exemple {idx + 1}
                  </button>
                ))}
              </div>

              {aiError && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
                >
                  {aiError}
                </p>
              )}

              {aiSummary && (
                <p
                  role="status"
                  className="rounded-lg border border-[#D4A853]/35 bg-[#D4A853]/10 px-3 py-2 text-xs text-amber-100"
                >
                  {aiSummary}
                </p>
              )}

              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4A853] px-4 py-2.5 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] disabled:opacity-45 cursor-pointer"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Configuration de la campagne…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Configurer avec l’assistant IA</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Manual Campaign Settings Card */}
          <section
            aria-labelledby="campaign-settings-heading"
            className="rounded-xl border border-white/[0.08] bg-[#131318] p-5 space-y-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="campaign-settings-heading"
                className="text-sm font-semibold text-zinc-100"
              >
                Paramètres de la série
              </h2>
              <button
                type="button"
                onClick={handleCopyCampaignSummary}
                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer whitespace-nowrap"
              >
                {copiedSummary ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copier le résumé</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label
                htmlFor="campaign-name"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Nom de la campagne
              </label>
              <input
                id="campaign-name"
                type="text"
                value={campaignConfig.name}
                onChange={(e) => onUpdateCampaignConfig({ name: e.target.value })}
                className="w-full rounded-lg border border-white/[0.1] bg-[#0D0D11] px-3 py-2 text-xs text-zinc-100 focus:border-[#D4A853] focus:outline-none"
              />
            </div>

            {/* Cadence & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label htmlFor="videos-per-day" className="font-medium text-zinc-300">
                    Vidéos / jour
                  </label>
                  <span className="font-mono-tabular text-[#D4A853]">
                    {campaignConfig.videosPerDay}
                  </span>
                </div>
                <input
                  id="videos-per-day"
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={campaignConfig.videosPerDay}
                  onChange={(e) =>
                    onUpdateCampaignConfig({ videosPerDay: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <label htmlFor="duration-days" className="font-medium text-zinc-300">
                    Durée (jours)
                  </label>
                  <span className="font-mono-tabular text-[#D4A853]">
                    {campaignConfig.durationDays} j
                  </span>
                </div>
                <input
                  id="duration-days"
                  type="range"
                  min={7}
                  max={30}
                  step={1}
                  value={campaignConfig.durationDays}
                  onChange={(e) =>
                    onUpdateCampaignConfig({ durationDays: Number(e.target.value) })
                  }
                  className="studio-slider w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="slot-mode"
                  className="mb-1.5 block text-xs font-medium text-zinc-300"
                >
                  Créneaux horaires
                </label>
                <select
                  id="slot-mode"
                  value={campaignConfig.slotMode}
                  onChange={(e) =>
                    onUpdateCampaignConfig({
                      slotMode: e.target.value as PublicationSlotMode,
                    })
                  }
                  className="w-full rounded-lg border border-white/[0.1] bg-[#0D0D11] px-2.5 py-2 text-xs text-zinc-100 focus:border-[#D4A853] focus:outline-none"
                >
                  {SLOT_MODES.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#121216]">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="auto-language"
                  className="mb-1.5 block text-xs font-medium text-zinc-300"
                >
                  Sous-titres
                </label>
                <select
                  id="auto-language"
                  value={campaignConfig.subtitleLanguage}
                  onChange={(e) =>
                    onUpdateCampaignConfig({
                      subtitleLanguage: e.target.value as SubtitleLanguage,
                    })
                  }
                  className="w-full rounded-lg border border-white/[0.1] bg-[#0D0D11] px-2.5 py-2 text-xs text-zinc-100 focus:border-[#D4A853] focus:outline-none"
                >
                  {(Object.keys(LANGUAGE_LABELS) as SubtitleLanguage[]).map((lang) => (
                    <option key={lang} value={lang} className="bg-[#121216]">
                      {LANGUAGE_LABELS[lang]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Style families selector */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-300">
                Familles visuelles incluses ({campaignConfig.selectedFamilies.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STYLE_FAMILIES.map((fam) => {
                  const selected = campaignConfig.selectedFamilies.includes(fam.id);
                  return (
                    <button
                      key={fam.id}
                      type="button"
                      onClick={() => toggleFamily(fam.id)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#D4A853] bg-[#D4A853]/15 text-zinc-50'
                          : 'border-white/[0.08] bg-[#0D0D11] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {fam.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reciter rotation multi-select */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-300">
                Récitateurs en alternance ({campaignConfig.selectedReciterIds.length})
              </p>
              <div className="grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0D0D11] p-2">
                {RECITERS.map((reciter) => {
                  const checked = campaignConfig.selectedReciterIds.includes(reciter.id);
                  return (
                    <label
                      key={reciter.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/[0.04] cursor-pointer"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleReciter(reciter.id)}
                          className="h-3.5 w-3.5 accent-[#D4A853] cursor-pointer"
                        />
                        <span className="truncate">{reciter.name}</span>
                      </span>
                      <span className="text-[11px] text-zinc-500 shrink-0">
                        {reciter.tradition}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Smart safeguard switches */}
            <div className="space-y-2.5 border-t border-white/[0.07] pt-3">
              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Éviter la répétition des passages (anti-doublon)</span>
                <input
                  type="checkbox"
                  checked={campaignConfig.avoidDuplicates}
                  onChange={(e) =>
                    onUpdateCampaignConfig({ avoidDuplicates: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#D4A853] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Varier les modèles visuels chaque jour</span>
                <input
                  type="checkbox"
                  checked={campaignConfig.varyStyles}
                  onChange={(e) =>
                    onUpdateCampaignConfig({ varyStyles: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#D4A853] cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                <span>Alterner les récitateurs automatiquement</span>
                <input
                  type="checkbox"
                  checked={campaignConfig.alternateReciters}
                  onChange={(e) =>
                    onUpdateCampaignConfig({ alternateReciters: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#D4A853] cursor-pointer"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => handleRegenerateSchedule()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#D4A853]/50 bg-[#D4A853]/12 px-4 py-2.5 text-xs font-semibold text-[#F5E6C8] transition-colors hover:bg-[#D4A853]/22 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Générer le calendrier ({totals.totalVideos} vidéos · {totals.videosPerWeek}/sem.)
              </span>
            </button>
          </section>
        </div>

        {/* RIGHT COLUMN (7 cols): Calendar, Validation Queue, Platforms */}
        <div className="space-y-5 lg:col-span-7">
          {/* Sub-tab bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Vues d’automatisation"
              className="inline-flex rounded-lg border border-white/[0.08] bg-[#131318] p-1"
            >
              {(
                [
                  { id: 'calendar', label: 'Calendrier' },
                  { id: 'queue', label: `Vérification (${schedule.length - approvedCount})` },
                  { id: 'history', label: `Historique (${exportHistory.length})` },
                  { id: 'platforms', label: 'Plateformes' },
                ] as { id: AutomationTab; label: string }[]
              ).map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(t.id)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#D4A853] text-[#09090B]'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {activeTab !== 'platforms' && approvedCount < schedule.length && (
              <button
                type="button"
                onClick={onApproveAllPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#131318] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-[#D4A853]/50 hover:text-zinc-50 whitespace-nowrap cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                <span>Approuver toute la série</span>
              </button>
            )}
          </div>

          {captionError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200"
            >
              {captionError}
            </p>
          )}

          {/* SUB-VIEW 1: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              {groupedByDay.map(([dayIdx, group]) => (
                <section
                  key={dayIdx}
                  className="rounded-xl border border-white/[0.08] bg-[#131318] p-4"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
                        Jour {dayIdx + 1} · {group.label}
                      </h3>
                    </div>
                    <span className="font-mono-tabular text-[11px] text-zinc-500">
                      {group.items.length} vidéo{group.items.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {group.items.map((slot) => {
                      const isApproved = slot.status === 'approved';
                      const isOpening = isLoadingSlotId === slot.id;
                      const isCaptionBusy = captionLoadingId === slot.id;

                      return (
                        <article
                          key={slot.id}
                          className="rounded-lg border border-white/[0.07] bg-[#0D0D11] p-3.5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-tabular text-xs font-semibold text-[#D4A853]">
                                  {slot.scheduledTime}
                                </span>
                                <span className="text-sm font-medium text-zinc-100">
                                  Sourate {slot.surahNameFr} ({slot.surahNumber}:{slot.fromAyah}
                                  {slot.toAyah !== slot.fromAyah ? `–${slot.toAyah}` : ''})
                                </span>
                                <span
                                  dir="rtl"
                                  className="font-arabic text-sm text-zinc-400"
                                >
                                  {slot.surahNameAr}
                                </span>
                              </div>

                              <p className="mt-1 text-xs text-zinc-400">
                                {slot.reciterName} ({slot.tradition}) · Modèle « {slot.styleName} » ·{' '}
                                {LANGUAGE_LABELS[slot.subtitleLanguage]}
                              </p>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-emerald-400/90">
                                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  {slot.quality.passed
                                    ? 'Contrôle qualité 4/4 validé'
                                    : 'À vérifier avant export'}
                                </span>
                                <span className="text-zinc-500">·</span>
                                <span
                                  className={
                                    isApproved ? 'text-[#D4A853]' : 'text-zinc-400'
                                  }
                                >
                                  {isApproved
                                    ? 'Validée par le créateur'
                                    : 'En attente de validation'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => onToggleApproveSlot(slot.id)}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                  isApproved
                                    ? 'border-[#D4A853]/60 bg-[#D4A853]/15 text-[#F5E6C8]'
                                    : 'border-white/[0.12] bg-[#16161D] text-zinc-300 hover:border-[#D4A853]/45'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{isApproved ? 'Approuvée' : 'Approuver'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleGenerateCaption(slot)}
                                disabled={isCaptionBusy}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#16161D] px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-[#D4A853]/45 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                              >
                                {isCaptionBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4A853]" aria-hidden="true" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                                )}
                                <span>Légende IA</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenSlotInStudio(slot)}
                                disabled={isOpening}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] disabled:opacity-55 whitespace-nowrap cursor-pointer"
                              >
                                {isOpening ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                ) : (
                                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                                <span>Ouvrir dans le Studio</span>
                              </button>
                            </div>
                          </div>

                          {/* Generated AI Caption box */}
                          {slot.caption && (
                            <div className="mt-3 rounded-lg border border-[#D4A853]/25 bg-[#14141A] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs leading-relaxed text-zinc-200">
                                  {slot.caption}
                                </p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(
                                      slot.id,
                                      `${slot.caption}\n\n${(slot.hashtags ?? []).join(' ')}`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#D4A853] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {copiedId === slot.id ? 'Copié' : 'Copier'}
                                </button>
                              </div>
                              {slot.hashtags && slot.hashtags.length > 0 && (
                                <p className="mt-1.5 text-[11px] text-zinc-400">
                                  {slot.hashtags.join(' ')}
                                </p>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}

          {/* SUB-VIEW 2: QUALITY & APPROVAL QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: 'all', label: `Toutes (${schedule.length})` },
                    {
                      id: 'pending-review',
                      label: `En attente (${schedule.length - approvedCount})`,
                    },
                    { id: 'approved', label: `Approuvées (${approvedCount})` },
                  ] as { id: 'all' | 'pending-review' | 'approved'; label: string }[]
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQueueFilter(f.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      queueFilter === f.id
                        ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                        : 'border-white/[0.08] bg-[#131318] text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredQueue.map((slot) => (
                  <article
                    key={slot.id}
                    className="rounded-xl border border-white/[0.08] bg-[#131318] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {slot.scheduledDateLabel} · {slot.scheduledTime} — Sourate{' '}
                          {slot.surahNameFr} ({slot.surahNumber}:{slot.fromAyah}–{slot.toAyah})
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {slot.reciterName} ({slot.tradition}) · {slot.styleName}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleApproveSlot(slot.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
                            slot.status === 'approved'
                              ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5E6C8]'
                              : 'border-white/[0.12] bg-[#1A1A22] text-zinc-200 hover:border-[#D4A853]/50'
                          }`}
                        >
                          {slot.status === 'approved' ? 'Approuvée' : 'Valider cette vidéo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenSlotInStudio(slot)}
                          className="rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-[#09090B] hover:bg-[#e2ba6a] cursor-pointer whitespace-nowrap"
                        >
                          Prévisualiser
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-[11px] sm:grid-cols-4">
                      <span className={slot.quality.arabicIntegrity ? 'text-emerald-400' : 'text-red-400'}>
                        ✓ Texte Uthmani valide
                      </span>
                      <span className={slot.quality.audioSourceVerified ? 'text-emerald-400' : 'text-red-400'}>
                        ✓ Source audio vérifiée
                      </span>
                      <span className={slot.quality.contrastReadable ? 'text-emerald-400' : 'text-red-400'}>
                        ✓ Contraste lisible
                      </span>
                      <span className={slot.quality.noDuplicate ? 'text-emerald-400' : 'text-amber-300'}>
                        {slot.quality.noDuplicate ? '✓ Passage unique' : '! Doublon détecté'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: DASHBOARD & EXPORT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-white/[0.08] bg-[#131318] p-5">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Cycle de production et de vérification
                </h3>
                <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {PRODUCTION_CYCLE_STEPS.map((step) => (
                    <li
                      key={step}
                      className="rounded-lg border border-white/[0.06] bg-[#0D0D11] px-3 py-2 text-xs text-zinc-300"
                    >
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-[#131318] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Historique des vidéos et sous-titres exportés
                  </h3>
                  <span className="font-mono-tabular text-xs text-zinc-400">
                    {exportHistory.length} export{exportHistory.length > 1 ? 's' : ''}
                  </span>
                </div>

                {exportHistory.length === 0 ? (
                  <p className="rounded-lg border border-white/[0.06] bg-[#0D0D11] p-4 text-xs text-zinc-400">
                    Aucun export enregistré pour le moment. Ouvrez une vidéo dans le Studio puis cliquez sur « Exporter la vidéo » ou téléchargez un fichier .SRT pour voir votre historique ici.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {exportHistory.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#0D0D11] px-3.5 py-2.5"
                      >
                        <div>
                          <p className="text-xs font-medium text-zinc-100">
                            {item.surahLabel}
                          </p>
                          <p className="mt-0.5 text-[11px] text-zinc-400">
                            {item.reciterName} · {item.styleName} · {item.exportedAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 font-mono-tabular text-xs">
                          <span className="text-zinc-400">{item.durationSec}s</span>
                          <span className="font-semibold text-[#D4A853]">
                            {item.resolution}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-VIEW 4: PLATFORMS & COMPLIANCE */}
          {activeTab === 'platforms' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-[#131318] p-5">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Publication responsable et validation créateur
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                  NoorReel prépare chaque vidéo en 9:16 avec contrôle automatique du texte arabe, de la synchronisation audio et de la lisibilité. Conformément aux règles de la TikTok Content Posting API et des plateformes sociales, aucune vidéo n’est publiée à l’insu du créateur : vous validez votre série, générez vos légendes, puis exportez les vidéos prêtes à publier ou programmer.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {PLATFORM_META.map((platform) => {
                  const selected = campaignConfig.platforms.includes(platform.id);
                  return (
                    <article
                      key={platform.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        selected
                          ? 'border-[#D4A853]/60 bg-[#D4A853]/[0.06]'
                          : 'border-white/[0.08] bg-[#131318]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-zinc-100">
                          {platform.label}
                        </h4>
                        <label className="inline-flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePlatform(platform.id)}
                            className="h-4 w-4 accent-[#D4A853] cursor-pointer"
                          />
                          <span>Inclure</span>
                        </label>
                      </div>
                      <p className="mt-1 font-mono-tabular text-[11px] text-[#D4A853]">
                        {platform.spec}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                        {platform.policyNote}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
