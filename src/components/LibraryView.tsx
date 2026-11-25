import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Play,
  Search,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  ARABIC_FONTS,
  DEFAULT_SCENES,
  RECITERS,
  SCENE_TRANSITIONS,
  STYLE_FAMILIES,
  STYLE_PRESETS,
} from '../data/quranLibrary';
import {
  ArabicFontFamily,
  RecitationTradition,
  ReciterOption,
  SceneAsset,
  SceneTransitionStyle,
  StudioConfig,
  StyleFamily,
  StylePreset,
  TextAnimationStyle,
} from '../types/studio';

type LibrarySection = 'styles' | 'reciters' | 'scenes' | 'typography';

interface LibraryViewProps {
  config: StudioConfig;
  scenes: SceneAsset[];
  customStyles: StylePreset[];
  onUseStyleInStudio: (preset: StylePreset) => void;
  onDeleteCustomStyle: (styleId: string) => void;
  onSelectReciter: (reciterId: string) => void;
  onUseSceneInStudio: (sceneId: string) => void;
  onApplyArabicFont: (font: ArabicFontFamily) => void;
  onApplyTextAnimation: (anim: TextAnimationStyle) => void;
  onApplyTransition: (transition: SceneTransitionStyle) => void;
}

const FAMILY_LABEL_MAP: Record<StyleFamily, string> = Object.fromEntries(
  STYLE_FAMILIES.map((f) => [f.id, f.label])
) as Record<StyleFamily, string>;

const LAYOUT_LABEL_MAP: Record<StylePreset['layoutMode'], string> = {
  'cinematic-center': 'Cinématique centré',
  'light-editorial': 'Papier clair',
  'mushaf-frame': 'Cadre Mushaf',
  'minimal-obsidian': 'Minimaliste',
  'editorial-bottom': 'Cadrage bas',
  'study-focus': 'Bandeau d’étude',
};

const ANIMATION_SHORT_LABEL: Record<StylePreset['textAnimation'], string> = {
  karaoke: 'Karaoké',
  'luminous-reveal': 'Mot par mot',
  'line-reveal': 'Ligne par ligne',
  'dynamic-focus': 'Focus dynamique',
  'mask-reveal': 'Masque RTL',
  'mushaf-page': 'Page Mushaf',
  'cinematic-fade': 'Fondu',
  'vertical-rise': 'Ascendant',
};

const TEXT_ANIMATION_CATALOG: {
  id: TextAnimationStyle;
  label: string;
  description: string;
}[] = [
  { id: 'karaoke', label: 'Karaoké lumineux', description: 'Met en lumière chaque mot au rythme de la récitation.' },
  { id: 'luminous-reveal', label: 'Mot par mot', description: 'Révèle les mots un à un sans déformer la calligraphie.' },
  { id: 'line-reveal', label: 'Ligne par ligne', description: 'Apparition douce et structurée ligne après ligne.' },
  { id: 'dynamic-focus', label: 'Focus dynamique', description: 'Verset actif net entouré des versets précédent et suivant en retrait.' },
  { id: 'mask-reveal', label: 'Révélation par masque', description: 'Dévoilement géométrique droite-gauche préservant les ligatures arabes.' },
  { id: 'mushaf-page', label: 'Page de Mushaf', description: 'Numérotation arabe traditionnelle ﴿١﴾ et rythme classique.' },
  { id: 'cinematic-fade', label: 'Fondu cinématique', description: 'Apparition et disparition apaisantes du verset complet.' },
  { id: 'vertical-rise', label: 'Défilement ascendant', description: 'Mouvement vertical fluide adapté aux formats courts.' },
];

/**
 * Miniature 9:16 visual preview reflecting each style's real background, light/dark surface,
 * layout chrome (Mushaf border, obsidian ticks, study band, lower-third), and palette.
 */
function StylePreviewCard({
  preset,
  scene,
  isActive,
  onUse,
  onDelete,
}: {
  preset: StylePreset;
  scene: SceneAsset | undefined;
  isActive: boolean;
  onUse: () => void;
  onDelete?: () => void;
}) {
  const isLight =
    preset.layoutMode === 'light-editorial' ||
    (preset.scrimOpacity < 0.22 && (scene?.isLightSurface || preset.arabicColor.startsWith('#1')));

  const bgGradient = scene
    ? `linear-gradient(160deg, ${scene.fallbackGradient[0]}, ${scene.fallbackGradient[1]}, ${scene.fallbackGradient[2]})`
    : 'linear-gradient(160deg, #11131a, #1c1c24, #09090b)';

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border bg-[#131318] transition-colors duration-150 ${
        isActive ? 'border-[#D4A853]/75' : 'border-white/[0.08] hover:border-white/[0.18]'
      }`}
    >
      {/* Live 9:16 composition miniature */}
      <div
        className="relative aspect-[9/14] w-full overflow-hidden select-none"
        style={{ background: bgGradient }}
      >
        {scene && scene.type === 'image' && scene.url && (
          <img
            src={scene.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}

        {/* Scrim or light ivory wash */}
        <div
          className="absolute inset-0"
          style={{
            background: isLight
              ? 'radial-gradient(circle at 50% 50%, rgba(252,248,240,0.12), rgba(145,120,86,0.18))'
              : `linear-gradient(180deg, rgba(6,7,11,${Math.min(0.9, preset.scrimOpacity * 0.9)}) 0%, rgba(6,7,11,${Math.min(0.84, preset.scrimOpacity * 0.72)}) 52%, rgba(6,7,11,${Math.min(0.95, preset.scrimOpacity * 1.08)}) 100%)`,
          }}
        />

        {/* Layout chrome preview */}
        {preset.layoutMode === 'mushaf-frame' && (
          <div
            className="pointer-events-none absolute inset-3 border"
            style={{
              borderColor: preset.accentColor,
              opacity: isLight ? 0.65 : 0.5,
              backgroundColor: isLight ? 'rgba(250,245,234,0.42)' : 'rgba(10,8,6,0.34)',
            }}
          >
            <div
              className="absolute inset-1.5 border"
              style={{ borderColor: preset.accentColor, opacity: 0.45 }}
            />
          </div>
        )}

        {preset.layoutMode === 'minimal-obsidian' && (
          <div className="pointer-events-none absolute inset-4">
            <span
              className="absolute left-0 top-0 h-3 w-3 border-l border-t"
              style={{ borderColor: preset.accentColor, opacity: 0.5 }}
            />
            <span
              className="absolute right-0 top-0 h-3 w-3 border-r border-t"
              style={{ borderColor: preset.accentColor, opacity: 0.5 }}
            />
            <span
              className="absolute bottom-0 left-0 h-3 w-3 border-b border-l"
              style={{ borderColor: preset.accentColor, opacity: 0.5 }}
            />
            <span
              className="absolute bottom-0 right-0 h-3 w-3 border-b border-r"
              style={{ borderColor: preset.accentColor, opacity: 0.5 }}
            />
          </div>
        )}

        {preset.layoutMode === 'editorial-bottom' && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
            style={{
              background:
                'linear-gradient(180deg, rgba(6,7,11,0) 0%, rgba(6,7,11,0.72) 45%, rgba(6,7,11,0.92) 100%)',
            }}
          />
        )}

        {/* Miniature sample verse positioned according to layoutMode */}
        <div
          className={`relative z-10 flex h-full flex-col items-center px-5 text-center ${
            preset.layoutMode === 'editorial-bottom'
              ? 'justify-end pb-7'
              : 'justify-center'
          }`}
        >
          <span
            className="mb-2.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: preset.accentColor }}
          >
            Al-Inshirah · 94:5
          </span>

          <div
            className={`w-full ${
              preset.layoutMode === 'study-focus'
                ? 'rounded-lg border px-3 py-3'
                : ''
            }`}
            style={
              preset.layoutMode === 'study-focus'
                ? {
                    backgroundColor: isLight
                      ? 'rgba(255,253,248,0.88)'
                      : 'rgba(12,13,18,0.78)',
                    borderColor: isLight
                      ? 'rgba(180,131,47,0.34)'
                      : 'rgba(212,168,83,0.34)',
                  }
                : undefined
            }
          >
            <p
              dir="rtl"
              className="font-arabic text-[17px] font-bold leading-relaxed"
              style={{ color: preset.arabicColor }}
            >
              فَإِنَّ مَعَ الْعُسْرِ يُسْرًا
              {preset.layoutMode === 'mushaf-frame' || preset.textAnimation === 'mushaf-page'
                ? ' ﴿٥﴾'
                : ''}
            </p>
            {preset.showOrnament && (
              <div className="my-2 flex items-center justify-center gap-1.5 opacity-75">
                <span
                  className="h-[1px] w-7"
                  style={{ backgroundColor: preset.accentColor }}
                />
                <span
                  className="h-1.5 w-1.5 rotate-45"
                  style={{ backgroundColor: preset.accentColor }}
                />
                <span
                  className="h-[1px] w-7"
                  style={{ backgroundColor: preset.accentColor }}
                />
              </div>
            )}
            <p
              className={`mt-1.5 text-[11px] leading-snug ${
                preset.translationFont === 'editorial' ? 'font-serif italic' : 'font-sans'
              }`}
              style={{ color: preset.translationColor }}
            >
              À côté de la difficulté est certes une facilité.
            </p>
          </div>
        </div>
      </div>

      {/* Clean card footer (no static pill clutter) */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100">{preset.name}</h3>
            {isActive && (
              <span className="text-[11px] font-medium text-[#D4A853] whitespace-nowrap shrink-0">
                Actif
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {preset.description}
          </p>
          <p className="mt-2 text-[11px] text-zinc-500">
            {FAMILY_LABEL_MAP[preset.family]} · {LAYOUT_LABEL_MAP[preset.layoutMode]} ·{' '}
            {ANIMATION_SHORT_LABEL[preset.textAnimation]}
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onUse}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-2 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
          >
            {isActive ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Ouvrir dans le Studio</span>
              </>
            ) : (
              <span>Utiliser dans le Studio</span>
            )}
          </button>

          {preset.isCustom && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Supprimer le style ${preset.name}`}
              className="rounded-lg border border-white/[0.1] p-2 text-zinc-400 transition-colors hover:border-red-500/40 hover:text-red-300 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function LibraryView({
  config,
  scenes,
  customStyles,
  onUseStyleInStudio,
  onDeleteCustomStyle,
  onSelectReciter,
  onUseSceneInStudio,
  onApplyArabicFont,
  onApplyTextAnimation,
  onApplyTransition,
}: LibraryViewProps) {
  const [section, setSection] = useState<LibrarySection>('styles');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFamily, setSelectedFamily] = useState<StyleFamily | 'all' | 'custom'>('all');
  const [traditionFilter, setTraditionFilter] = useState<'all' | RecitationTradition>('all');

  // Live audio excerpt player for reciter auditioning
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingReciterId, setPlayingReciterId] = useState<string | null>(null);
  const [loadingReciterId, setLoadingReciterId] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const stopPreviewAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingReciterId(null);
    setLoadingReciterId(null);
  };

  const handleToggleReciterAudio = (reciter: ReciterOption) => {
    setAudioError(null);
    if (playingReciterId === reciter.id || loadingReciterId === reciter.id) {
      stopPreviewAudio();
      return;
    }

    stopPreviewAudio();
    setLoadingReciterId(reciter.id);
    const url = `https://everyayah.com/data/${reciter.everyAyahFolder}/094001.mp3`;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    audio.oncanplay = () => {
      setLoadingReciterId(null);
      setPlayingReciterId(reciter.id);
    };
    audio.onended = () => {
      setPlayingReciterId(null);
    };
    audio.onerror = () => {
      setLoadingReciterId(null);
      setPlayingReciterId(null);
      setAudioError(`Impossible de lire l’extrait audio de ${reciter.name}.`);
    };

    audio.play().catch(() => {
      setLoadingReciterId(null);
      setPlayingReciterId(null);
      setAudioError(`Lecture bloquée par le navigateur pour ${reciter.name}.`);
    });
  };

  const allStyles = useMemo(
    () => [...customStyles, ...STYLE_PRESETS],
    [customStyles]
  );

  const sceneById = useMemo(() => {
    const map = new Map<string, SceneAsset>();
    [...DEFAULT_SCENES, ...scenes].forEach((s) => map.set(s.id, s));
    return map;
  }, [scenes]);

  const filteredStyles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allStyles.filter((style) => {
      if (selectedFamily === 'custom' && !style.isCustom) return false;
      if (
        selectedFamily !== 'all' &&
        selectedFamily !== 'custom' &&
        style.family !== selectedFamily
      ) {
        return false;
      }
      if (!q) return true;
      return (
        style.name.toLowerCase().includes(q) ||
        style.description.toLowerCase().includes(q) ||
        FAMILY_LABEL_MAP[style.family].toLowerCase().includes(q)
      );
    });
  }, [allStyles, selectedFamily, searchQuery]);

  const filteredReciters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return RECITERS.filter((r) => {
      if (traditionFilter !== 'all' && r.tradition !== traditionFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.origin.toLowerCase().includes(q) ||
        r.tradition.toLowerCase().includes(q)
      );
    });
  }, [traditionFilter, searchQuery]);

  const filteredScenes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scenes.filter((s) => {
      if (
        selectedFamily !== 'all' &&
        selectedFamily !== 'custom' &&
        s.family !== selectedFamily
      ) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.mood.toLowerCase().includes(q)
      );
    });
  }, [scenes, selectedFamily, searchQuery]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Sub-view switcher */}
      <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-50">
            Bibliothèque créative
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Modèles visuels, récitateurs authentiques (Hafs & Warsh) et scènes animées prêts pour le Studio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="Sections de la bibliothèque"
            className="inline-flex rounded-lg border border-white/[0.08] bg-[#131318] p-1"
          >
            {(
              [
                { id: 'styles', label: `Modèles (${allStyles.length})` },
                { id: 'reciters', label: `Récitateurs (${RECITERS.length})` },
                { id: 'scenes', label: `Scènes (${scenes.length})` },
                { id: 'typography', label: 'Polices & Animations' },
              ] as { id: LibrarySection; label: string }[]
            ).map((tab) => {
              const active = section === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSection(tab.id)}
                  className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#D4A853] text-[#09090B]'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un style, récitateur…"
              aria-label="Rechercher dans la bibliothèque"
              className="w-full rounded-lg border border-white/[0.1] bg-[#131318] py-2 pl-9 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4A853] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 1: VISUAL MODELS GALLERY */}
      {section === 'styles' && (
        <div className="mt-6 space-y-6">
          {/* Family filter strip */}
          <div
            role="group"
            aria-label="Filtrer par famille visuelle"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setSelectedFamily('all')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedFamily === 'all'
                  ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                  : 'border-white/[0.08] bg-[#131318] text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Tous les modèles
            </button>
            {customStyles.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedFamily('custom')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedFamily === 'custom'
                    ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                    : 'border-white/[0.08] bg-[#131318] text-zinc-400 hover:text-zinc-100'
                }`}
              >
                Mes styles ({customStyles.length})
              </button>
            )}
            {STYLE_FAMILIES.map((fam) => {
              const active = selectedFamily === fam.id;
              return (
                <button
                  key={fam.id}
                  type="button"
                  onClick={() => setSelectedFamily(fam.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                      : 'border-white/[0.08] bg-[#131318] text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {fam.label}
                </button>
              );
            })}
          </div>

          {filteredStyles.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#131318] p-10 text-center">
              <p className="text-sm text-zinc-300">
                Aucun modèle ne correspond à cette recherche.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFamily('all');
                }}
                className="mt-3 text-xs font-medium text-[#D4A853] hover:underline cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredStyles.map((preset) => (
                <StylePreviewCard
                  key={preset.id}
                  preset={preset}
                  scene={sceneById.get(preset.recommendedSceneId)}
                  isActive={config.activePresetId === preset.id}
                  onUse={() => onUseStyleInStudio(preset)}
                  onDelete={
                    preset.isCustom
                      ? () => onDeleteCustomStyle(preset.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: RECITERS & TRADITIONS (HAFS / WARSH) */}
      {section === 'reciters' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="group"
              aria-label="Filtrer par lecture"
              className="inline-flex rounded-lg border border-white/[0.08] bg-[#131318] p-1"
            >
              {(
                [
                  { id: 'all', label: `Toutes les lectures (${RECITERS.length})` },
                  {
                    id: 'Hafs',
                    label: `Hafs ’an ’Asim (${RECITERS.filter((r) => r.tradition === 'Hafs').length})`,
                  },
                  {
                    id: 'Warsh',
                    label: `Warsh ’an Nafi’ (${RECITERS.filter((r) => r.tradition === 'Warsh').length})`,
                  },
                ] as { id: 'all' | RecitationTradition; label: string }[]
              ).map((opt) => {
                const active = traditionFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTraditionFilter(opt.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#D4A853] text-[#09090B]'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-zinc-400">
              Extrait d’écoute : Sourate Al-Inshirah (94:1) · Sources audio vérifiées
            </p>
          </div>

          {audioError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200"
            >
              {audioError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {filteredReciters.map((reciter) => {
              const isSelected = config.reciterId === reciter.id;
              const isPlaying = playingReciterId === reciter.id;
              const isLoading = loadingReciterId === reciter.id;

              return (
                <article
                  key={reciter.id}
                  className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? 'border-[#D4A853]/70 bg-[#D4A853]/[0.06]'
                      : 'border-white/[0.08] bg-[#131318] hover:border-white/[0.16]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {reciter.name}
                      </h3>
                      <span className="text-xs font-medium text-[#D4A853] whitespace-nowrap shrink-0">
                        {reciter.tradition}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {reciter.style} · {reciter.origin}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleReciterAudio(reciter)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#1A1A22] px-3 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-[#D4A853]/50 hover:text-zinc-50 whitespace-nowrap cursor-pointer"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4A853]" aria-hidden="true" />
                      ) : isPlaying ? (
                        <Square className="h-3 w-3 fill-[#D4A853] text-[#D4A853]" aria-hidden="true" />
                      ) : (
                        <Play className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                      )}
                      <span>{isPlaying ? 'Arrêter' : 'Écouter'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        stopPreviewAudio();
                        onSelectReciter(reciter.id);
                      }}
                      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'border border-[#D4A853]/50 bg-[#D4A853]/15 text-[#F5E6C8]'
                          : 'bg-[#D4A853] text-[#09090B] hover:bg-[#e2ba6a]'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Récitateur actif</span>
                        </>
                      ) : (
                        <span>Sélectionner pour le Studio</span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: SCENES & LIVING 4K ANIMATIONS */}
      {section === 'scenes' && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredScenes.map((scene) => {
              const isSelected = config.activeSceneId === scene.id;
              return (
                <article
                  key={scene.id}
                  className={`group flex flex-col overflow-hidden rounded-xl border bg-[#131318] transition-colors ${
                    isSelected
                      ? 'border-[#D4A853]/75'
                      : 'border-white/[0.08] hover:border-white/[0.18]'
                  }`}
                >
                  <div
                    className="relative aspect-[9/14] w-full overflow-hidden"
                    style={{
                      background: `linear-gradient(160deg, ${scene.fallbackGradient[0]}, ${scene.fallbackGradient[1]}, ${scene.fallbackGradient[2]})`,
                    }}
                  >
                    {scene.type === 'image' && scene.url && (
                      <img
                        src={scene.url}
                        alt={scene.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    )}
                    {scene.type === 'generative' && (
                      <div className="flex h-full w-full items-center justify-center p-4 text-center">
                        <span className="font-display text-xs tracking-wide text-[#F5E6C8]/90">
                          Rendu génératif 4K réactif à la voix
                        </span>
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
                    <div className="absolute inset-x-3 bottom-3">
                      <p className="text-xs font-semibold text-zinc-50">
                        {scene.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-300">
                        {scene.mood}
                      </p>
                    </div>
                  </div>
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => onUseSceneInStudio(scene.id)}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'border border-[#D4A853]/50 bg-[#D4A853]/15 text-[#F5E6C8]'
                          : 'bg-[#1D1D25] text-zinc-100 hover:bg-[#D4A853] hover:text-[#09090B]'
                      }`}
                    >
                      {isSelected ? 'Scène active' : 'Utiliser cette scène'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: TYPOGRAPHY, TEXT ANIMATIONS & TRANSITIONS */}
      {section === 'typography' && (
        <div className="mt-6 space-y-9">
          {/* Arabic Calligraphic Fonts */}
          <section aria-labelledby="fonts-lib-heading" className="space-y-4">
            <div>
              <h2
                id="fonts-lib-heading"
                className="text-base font-semibold text-zinc-100"
              >
                Bibliothèque typographique arabe ({ARABIC_FONTS.length} polices vérifiées)
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Toutes les polices préservent les voyelles (harakat), ligatures et signes diacritiques du texte Uthmani.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ARABIC_FONTS.map((font) => {
                const active = config.arabicFont === font.id;
                return (
                  <article
                    key={font.id}
                    className={`flex flex-col justify-between gap-4 rounded-xl border p-5 ${
                      active
                        ? 'border-[#D4A853]/70 bg-[#D4A853]/[0.06]'
                        : 'border-white/[0.08] bg-[#131318]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {font.label}
                        </h3>
                        {active && (
                          <span className="text-xs font-medium text-[#D4A853]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-400">{font.styleNote}</p>
                      <p
                        dir="rtl"
                        style={{ fontFamily: font.cssFamily }}
                        className="mt-4 rounded-lg border border-white/[0.06] bg-[#0B0B0F] px-4 py-4 text-center text-2xl leading-relaxed text-[#F5E6C8]"
                      >
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyArabicFont(font.id)}
                      className="rounded-lg bg-[#D4A853] px-3.5 py-2 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] cursor-pointer"
                    >
                      Utiliser cette police dans le Studio
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Text Animations Catalog */}
          <section aria-labelledby="anims-lib-heading" className="space-y-4">
            <div>
              <h2
                id="anims-lib-heading"
                className="text-base font-semibold text-zinc-100"
              >
                Moteur d’animation du texte coranique ({TEXT_ANIMATION_CATALOG.length} comportements)
              </h2>
              <p className="mt-0.5 text-xs text-zinc-400">
                Synchronisation naturelle avec la récitation sans jamais couper les lettres arabes.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {TEXT_ANIMATION_CATALOG.map((anim) => {
                const active = config.textAnimation === anim.id;
                return (
                  <article
                    key={anim.id}
                    className={`flex flex-col justify-between gap-3 rounded-xl border p-4 ${
                      active
                        ? 'border-[#D4A853]/70 bg-[#D4A853]/[0.06]'
                        : 'border-white/[0.08] bg-[#131318]'
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {anim.label}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                        {anim.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyTextAnimation(anim.id)}
                      className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'border border-[#D4A853]/50 bg-[#D4A853]/15 text-[#F5E6C8]'
                          : 'bg-[#1D1D25] text-zinc-100 hover:bg-[#D4A853] hover:text-[#09090B]'
                      }`}
                    >
                      {active ? 'Animation active' : 'Appliquer au Studio'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Cinematic Scene Transitions */}
          <section aria-labelledby="trans-lib-heading" className="space-y-4">
            <div>
              <h2
                id="trans-lib-heading"
                className="text-base font-semibold text-zinc-100"
              >
                Transitions cinématiques entre scènes ({SCENE_TRANSITIONS.length} effets)
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {SCENE_TRANSITIONS.map((tr) => {
                const active = config.sceneTransition === tr.id;
                return (
                  <article
                    key={tr.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${
                      active
                        ? 'border-[#D4A853]/70 bg-[#D4A853]/[0.06]'
                        : 'border-white/[0.08] bg-[#131318]'
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {tr.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {tr.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyTransition(tr.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'border border-[#D4A853]/50 bg-[#D4A853]/15 text-[#F5E6C8]'
                          : 'bg-[#1D1D25] text-zinc-100 hover:bg-[#D4A853] hover:text-[#09090B]'
                      }`}
                    >
                      {active ? 'Active' : 'Appliquer'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
