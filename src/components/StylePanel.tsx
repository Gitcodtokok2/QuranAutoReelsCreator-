import { FormEvent, useState } from 'react';
import {
  ArrowUpRight,
  BookmarkPlus,
  Check,
  ClipboardCopy,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { ARABIC_FONTS, STYLE_PRESETS } from '../data/quranLibrary';
import {
  ArabicFontFamily,
  SceneTransitionStyle,
  StudioConfig,
  StyleLayoutMode,
  StylePreset,
  TextAnimationStyle,
  TranslationFontFamily,
  VerseItem,
} from '../types/studio';

interface StylePanelProps {
  config: StudioConfig;
  verses: VerseItem[];
  customStyles: StylePreset[];
  onUpdateConfig: (patch: Partial<StudioConfig>) => void;
  onApplyPreset: (preset: StylePreset) => void;
  onSaveCustomStyle: (name: string) => void;
  onOpenLibrary: () => void;
}

const ANIMATION_MODES: { id: TextAnimationStyle; label: string; hint: string }[] = [
  { id: 'karaoke', label: 'Karaoké lumineux', hint: 'Surligne chaque mot au fil du verset' },
  { id: 'luminous-reveal', label: 'Mot par mot', hint: 'Apparition progressive de chaque mot' },
  { id: 'line-reveal', label: 'Ligne par ligne', hint: 'Révélation fluide ligne après ligne' },
  { id: 'dynamic-focus', label: 'Focus dynamique', hint: 'Verset actif net entouré du contexte précédent/suivant' },
  { id: 'mask-reveal', label: 'Révélation par masque', hint: 'Dévoilement droite-gauche sans déformer les ligatures' },
  { id: 'mushaf-page', label: 'Page de Mushaf', hint: 'Numérotation arabe ﴿١﴾ et rythme classique' },
  { id: 'cinematic-fade', label: 'Fondu cinématique', hint: 'Apparition douce du verset complet' },
  { id: 'vertical-rise', label: 'Défilement ascendant', hint: 'Élévation verticale fluide' },
];

const LAYOUT_MODES: { id: StyleLayoutMode; label: string }[] = [
  { id: 'cinematic-center', label: 'Cinématique centré' },
  { id: 'mushaf-frame', label: 'Cadre Mushaf doré' },
  { id: 'light-editorial', label: 'Papier clair ivoire' },
  { id: 'minimal-obsidian', label: 'Obsidienne minimal' },
  { id: 'editorial-bottom', label: 'Cadrage bas' },
  { id: 'study-focus', label: 'Bandeau d’étude' },
];

const TRANSLATION_FONTS: { id: TranslationFontFamily; label: string }[] = [
  { id: 'editorial', label: 'Éditorial Sérif' },
  { id: 'modern', label: 'Moderne Sans' },
];

export function StylePanel({
  config,
  verses,
  customStyles,
  onUpdateConfig,
  onApplyPreset,
  onSaveCustomStyle,
  onOpenLibrary,
}: StylePanelProps) {
  const [styleName, setStyleName] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // AI Artistic Director state
  const [directorBrief, setDirectorBrief] = useState('');
  const [directorLoading, setDirectorLoading] = useState(false);
  const [directorNote, setDirectorNote] = useState<string | null>(null);
  const [directorError, setDirectorError] = useState<string | null>(null);

  const allStyles = [...customStyles, ...STYLE_PRESETS];
  const featuredPresets = [...customStyles, ...STYLE_PRESETS.slice(0, 6)];

  const handleSaveSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = styleName.trim();
    if (!cleaned) return;
    onSaveCustomStyle(cleaned);
    setStyleName('');
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2600);
  };

  const handleAskDirector = async (e: FormEvent) => {
    e.preventDefault();
    if (directorLoading || verses.length === 0) return;

    setDirectorLoading(true);
    setDirectorError(null);
    setDirectorNote(null);

    try {
      const response = await fetch('/api/ai/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surahNameFr: verses[0].surahNameFr,
          surahNumber: verses[0].surahNumber,
          sampleFrench: verses[0].french,
          brief: directorBrief.trim() || undefined,
          availableStyleIds: STYLE_PRESETS.map((s) => s.id),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Le directeur artistique IA est indisponible.');
      }

      const matched = allStyles.find((s) => s.id === data.styleId);
      if (matched) {
        onApplyPreset(matched);
      }

      const validAnims = new Set<TextAnimationStyle>(ANIMATION_MODES.map((m) => m.id));
      const validFonts = new Set<ArabicFontFamily>(ARABIC_FONTS.map((f) => f.id));
      const validTrans = new Set<SceneTransitionStyle>([
        'crossfade',
        'slow-zoom',
        'slide-up',
        'cinematic-blur',
        'golden-flash',
        'dip-black',
      ]);

      onUpdateConfig({
        ...(validAnims.has(data.textAnimation) ? { textAnimation: data.textAnimation } : {}),
        ...(validFonts.has(data.arabicFont) ? { arabicFont: data.arabicFont } : {}),
        ...(validTrans.has(data.transition) ? { sceneTransition: data.transition } : {}),
      });

      setDirectorNote(
        typeof data.rationale === 'string' && data.rationale.trim()
          ? data.rationale
          : `Direction appliquée : ${matched?.name ?? 'composition harmonisée'}.`
      );
    } catch (err) {
      setDirectorError(
        err instanceof Error
          ? err.message
          : 'Impossible de contacter le directeur artistique IA.'
      );
    } finally {
      setDirectorLoading(false);
    }
  };

  const handleCopyConfig = () => {
    const activeStyle = allStyles.find((s) => s.id === config.activePresetId);
    const activeFont = ARABIC_FONTS.find((f) => f.id === config.arabicFont);
    const payload = [
      `NoorReel — Configuration Studio`,
      `Sourate : ${verses[0]?.surahNameFr ?? 'Personnalisée'} (${verses.length} versets · ${config.memorizationRepeat}×)`,
      `Style : ${activeStyle?.name ?? config.layoutMode}`,
      `Police arabe : ${activeFont?.label ?? config.arabicFont} (${config.arabicFontSize}px)`,
      `Animation : ${ANIMATION_MODES.find((a) => a.id === config.textAnimation)?.label ?? config.textAnimation}`,
      `Langue : ${config.subtitleLanguage} · Format 9:16`,
    ].join('\n');
    navigator.clipboard?.writeText(payload).catch(() => {});
    setCopiedConfig(true);
    window.setTimeout(() => setCopiedConfig(false), 2000);
  };

  return (
    <div className="space-y-7">
      {/* AI Artistic Director */}
      <section
        aria-labelledby="director-heading"
        className="rounded-xl border border-white/[0.08] bg-[#141419] p-3.5 space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
            <h2 id="director-heading" className="text-xs font-semibold text-zinc-100">
              Directeur artistique IA
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCopyConfig}
            className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-100 cursor-pointer whitespace-nowrap"
          >
            {copiedConfig ? (
              <>
                <Check className="h-3 w-3 text-[#D4A853]" aria-hidden="true" />
                <span>Copié</span>
              </>
            ) : (
              <>
                <ClipboardCopy className="h-3 w-3" aria-hidden="true" />
                <span>Copier config</span>
              </>
            )}
          </button>
        </div>
        <form onSubmit={handleAskDirector} className="flex gap-2">
          <input
            type="text"
            value={directorBrief}
            onChange={(e) => setDirectorBrief(e.target.value)}
            placeholder="Ex. Aquarelle douce ou Mushaf solennel…"
            aria-label="Souhait artistique pour le directeur IA"
            className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-[#0D0D11] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4A853] focus:outline-none"
          />
          <button
            type="submit"
            disabled={directorLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#D4A853] px-3 py-1.5 text-xs font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {directorLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <span>Suggérer</span>
            )}
          </button>
        </form>
        {directorError && (
          <p role="alert" className="text-[11px] text-red-300">
            {directorError}
          </p>
        )}
        {directorNote && (
          <p role="status" className="text-[11px] leading-relaxed text-amber-100/90">
            {directorNote}
          </p>
        )}
      </section>

      {/* Quick Styles + Link to full Bibliothèque */}
      <section aria-labelledby="presets-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="presets-heading" className="text-sm font-semibold text-zinc-100">
            Styles rapides
          </h2>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#D4A853] hover:text-[#e6be6c] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Voir les {allStyles.length} modèles</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {featuredPresets.map((preset) => {
            const isActive = config.activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                  isActive
                    ? 'border-[#D4A853]/65 bg-[#D4A853]/[0.08]'
                    : 'border-white/[0.07] bg-[#141419] hover:border-white/[0.16]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {preset.name}
                    </p>
                    {preset.isCustom && (
                      <span className="text-[11px] font-medium text-[#D4A853] shrink-0">
                        Personnel
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {preset.description}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
                  <span
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.arabicColor }}
                  />
                  <span
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: preset.accentColor }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Layout composition mode */}
      <section aria-labelledby="composition-heading" className="space-y-3">
        <h2
          id="composition-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Mise en page de l’écran
        </h2>
        <div className="grid grid-cols-2 gap-1.5">
          {LAYOUT_MODES.map((layout) => {
            const active = config.layoutMode === layout.id;
            return (
              <button
                key={layout.id}
                type="button"
                onClick={() => onUpdateConfig({ layoutMode: layout.id })}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                    : 'border-white/[0.07] bg-[#141419] text-zinc-300 hover:border-white/[0.16]'
                }`}
              >
                {layout.label}
              </button>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Text animation mode (8 modes) */}
      <section aria-labelledby="animation-texte-heading" className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2
            id="animation-texte-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Animation du texte coranique
          </h2>
          <span className="text-xs text-zinc-500">{ANIMATION_MODES.length} modes</span>
        </div>

        <div className="grid grid-cols-1 gap-1.5">
          {ANIMATION_MODES.map((mode) => {
            const active = config.textAnimation === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onUpdateConfig({ textAnimation: mode.id })}
                className={`w-full rounded-lg border px-3.5 py-2 text-left transition-colors duration-150 cursor-pointer ${
                  active
                    ? 'border-[#D4A853] bg-[#D4A853]/12'
                    : 'border-white/[0.07] bg-[#141419] hover:border-white/[0.16]'
                }`}
              >
                <div className="text-xs font-semibold text-zinc-100">
                  {mode.label}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">{mode.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Typography sizes, Arabic calligraphy font & vertical alignment */}
      <section aria-labelledby="typo-reglages-heading" className="space-y-4">
        <h2
          id="typo-reglages-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Typographie arabe et cadrage
        </h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Police calligraphique arabe
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {ARABIC_FONTS.map((font) => {
              const active = config.arabicFont === font.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  onClick={() => onUpdateConfig({ arabicFont: font.id })}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#D4A853] bg-[#D4A853]/12 text-zinc-50'
                      : 'border-white/[0.07] bg-[#141419] text-zinc-300 hover:border-white/[0.16]'
                  }`}
                >
                  <div className="text-[11px] font-medium">{font.label}</div>
                  <div
                    dir="rtl"
                    style={{ fontFamily: font.cssFamily }}
                    className="mt-1 text-base text-[#F5E6C8]"
                  >
                    بِسْمِ اللَّهِ
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Police de traduction
          </label>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/[0.07] bg-[#141419] p-1">
            {TRANSLATION_FONTS.map((f) => {
              const active = config.translationFont === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onUpdateConfig({ translationFont: f.id })}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#D4A853] text-[#09090B]'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label htmlFor="arabic-size" className="font-medium text-zinc-300">
              Taille texte arabe
            </label>
            <span className="font-mono-tabular text-zinc-400">
              {config.arabicFontSize} px
            </span>
          </div>
          <input
            id="arabic-size"
            type="range"
            min={44}
            max={92}
            step={2}
            value={config.arabicFontSize}
            onChange={(e) =>
              onUpdateConfig({ arabicFontSize: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label htmlFor="translation-size" className="font-medium text-zinc-300">
              Taille traduction
            </label>
            <span className="font-mono-tabular text-zinc-400">
              {config.translationFontSize} px
            </span>
          </div>
          <input
            id="translation-size"
            type="range"
            min={24}
            max={54}
            step={2}
            value={config.translationFontSize}
            onChange={(e) =>
              onUpdateConfig({ translationFontSize: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label htmlFor="vertical-pos" className="font-medium text-zinc-300">
              Hauteur sur l’écran
            </label>
            <span className="font-mono-tabular text-zinc-400">
              {Math.round(config.verticalPosition * 100)}%
            </span>
          </div>
          <input
            id="vertical-pos"
            type="range"
            min={0.36}
            max={0.64}
            step={0.01}
            value={config.verticalPosition}
            onChange={(e) =>
              onUpdateConfig({ verticalPosition: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Overlays & Watermark */}
      <section aria-labelledby="habillage-heading" className="space-y-3.5">
        <h2 id="habillage-heading" className="text-sm font-semibold text-zinc-100">
          Habillage de la vidéo
        </h2>

        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
          <span>Afficher le nom de la sourate et le numéro</span>
          <input
            type="checkbox"
            checked={config.showSurahHeader}
            onChange={(e) =>
              onUpdateConfig({ showSurahHeader: e.target.checked })
            }
            className="h-4 w-4 accent-[#D4A853] cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
          <span>Séparateur ornemental doré</span>
          <input
            type="checkbox"
            checked={config.showOrnament}
            onChange={(e) => onUpdateConfig({ showOrnament: e.target.checked })}
            className="h-4 w-4 accent-[#D4A853] cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
          <span>Onde audio animée sous le verset</span>
          <input
            type="checkbox"
            checked={config.showAudioWave}
            onChange={(e) =>
              onUpdateConfig({ showAudioWave: e.target.checked })
            }
            className="h-4 w-4 accent-[#D4A853] cursor-pointer"
          />
        </label>

        <div className="pt-1">
          <label
            htmlFor="watermark-input"
            className="mb-1.5 block text-xs font-medium text-zinc-300"
          >
            Signature / Compte TikTok (optionnel)
          </label>
          <input
            id="watermark-input"
            type="text"
            maxLength={32}
            placeholder="@votrecompte"
            value={config.watermark}
            onChange={(e) => onUpdateConfig({ watermark: e.target.value })}
            className="w-full rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#D4A853] focus:outline-none"
          />
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Save current settings as a reusable custom style */}
      <section aria-labelledby="save-style-heading" className="space-y-2.5">
        <h2
          id="save-style-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Enregistrer comme modèle personnel
        </h2>
        <form onSubmit={handleSaveSubmit} className="flex gap-2">
          <input
            type="text"
            maxLength={36}
            placeholder="Ex. Mon style Fajr doré"
            value={styleName}
            onChange={(e) => setStyleName(e.target.value)}
            aria-label="Nom du style personnalisé"
            className="min-w-0 flex-1 rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-[#D4A853] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!styleName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4A853]/40 bg-[#D4A853]/12 px-3 py-2 text-xs font-medium text-[#F5E6C8] transition-colors hover:bg-[#D4A853]/20 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                <span>Enregistré</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                <span>Sauvegarder</span>
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
