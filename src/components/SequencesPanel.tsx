import {
  ArrowUpFromLine,
  Blend,
  Droplets,
  FileText,
  Moon,
  Play,
  RotateCcw,
  Sun,
  ZoomIn,
} from 'lucide-react';
import { SCENE_TRANSITIONS } from '../data/quranLibrary';
import {
  SceneTransitionStyle,
  StudioConfig,
  VerseItem,
} from '../types/studio';
import {
  computeTimelineSegments,
  formatTimecode,
  generateSrtSubtitles,
} from '../utils/timeline';

interface SequencesPanelProps {
  verses: VerseItem[];
  activeVerseIndex: number;
  config: StudioConfig;
  onJumpToVerse: (index: number) => void;
  onPreviewTransitionAtCut: (verseIndex: number) => void;
  onUpdateVerse: (index: number, patch: Partial<VerseItem>) => void;
  onUpdateConfig: (patch: Partial<StudioConfig>) => void;
  onResetDurations: () => void;
}

function TransitionIcon({
  style,
  size = 'md',
}: {
  style: SceneTransitionStyle;
  size?: 'sm' | 'md';
}) {
  const cls = size === 'sm' ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0';
  if (style === 'slow-zoom') return <ZoomIn className={cls} aria-hidden="true" />;
  if (style === 'slide-up') return <ArrowUpFromLine className={cls} aria-hidden="true" />;
  if (style === 'cinematic-blur') return <Droplets className={cls} aria-hidden="true" />;
  if (style === 'golden-flash') return <Sun className={cls} aria-hidden="true" />;
  if (style === 'dip-black') return <Moon className={cls} aria-hidden="true" />;
  return <Blend className={cls} aria-hidden="true" />;
}

export function SequencesPanel({
  verses,
  activeVerseIndex,
  config,
  onJumpToVerse,
  onPreviewTransitionAtCut,
  onUpdateVerse,
  onUpdateConfig,
  onResetDurations,
}: SequencesPanelProps) {
  const { segments, totalDuration } = computeTimelineSegments(verses);
  const editingEnglish = config.subtitleLanguage === 'ar-en';
  const hasMultipleVerses = verses.length > 1;
  const primaryTransitions = SCENE_TRANSITIONS.filter((t) => t.group === 'primary');
  const advancedTransitions = SCENE_TRANSITIONS.filter((t) => t.group === 'advanced');
  const activeTransitionMeta =
    SCENE_TRANSITIONS.find((t) => t.id === config.sceneTransition) ??
    SCENE_TRANSITIONS[0];

  const handleDownloadSrt = () => {
    const srtContent = generateSrtSubtitles(verses, config.subtitleLanguage);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const surahLabel =
      verses[0]?.surahNameFr.toLowerCase().replace(/\s+/g, '-') ?? 'coran';
    a.href = url;
    a.download = `noorreel-${surahLabel}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApplyGlobalTransition = (style: SceneTransitionStyle) => {
    onUpdateConfig({
      sceneTransition: style,
      autoCycleScenes: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Compact 3-style Transition Selector + Advanced Cinematic Effects */}
      <section aria-labelledby="transitions-library-heading" className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="transitions-library-heading"
              className="text-sm font-semibold text-zinc-100"
            >
              Style de transition
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {activeTransitionMeta.description}
            </p>
          </div>

          {hasMultipleVerses && (
            <button
              type="button"
              onClick={() => onPreviewTransitionAtCut(0)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4A853]/40 bg-[#D4A853]/10 px-3 py-1.5 text-xs font-medium text-[#F5E6C8] transition-colors hover:bg-[#D4A853]/20 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
            >
              <Play className="h-3 w-3 fill-current" aria-hidden="true" />
              <span>Tester</span>
            </button>
          )}
        </div>

        {!config.autoCycleScenes && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#141419] px-3 py-2 text-xs text-zinc-400">
            <span>Défilement multi-scènes désactivé</span>
            <button
              type="button"
              onClick={() => onUpdateConfig({ autoCycleScenes: true })}
              className="font-medium text-[#D4A853] hover:text-[#e6bf72] whitespace-nowrap cursor-pointer"
            >
              Activer
            </button>
          </div>
        )}

        <div
          role="radiogroup"
          aria-label="Style de transition entre scènes"
          className="space-y-2.5"
        >
          {/* Primary 3-style segmented selector: Fondu, Zoom, Glissement */}
          <div className="grid grid-cols-3 gap-2">
            {primaryTransitions.map((item) => {
              const isSelected = config.sceneTransition === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleApplyGlobalTransition(item.id)}
                  className={`flex min-h-[58px] flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                    isSelected
                      ? 'border-[#D4A853]/75 bg-[#D4A853]/[0.12] text-[#F5E6C8]'
                      : 'border-white/[0.08] bg-[#141419] text-zinc-300 hover:border-white/[0.18] hover:text-zinc-100'
                  }`}
                >
                  <span
                    className={
                      isSelected ? 'text-[#D4A853]' : 'text-zinc-400'
                    }
                  >
                    <TransitionIcon style={item.id} size="md" />
                  </span>
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Secondary compact row: Effets avancés (Flou, Voile doré, Noir) */}
          <div className="space-y-1.5 pt-0.5">
            <p className="text-[11px] font-medium text-zinc-400">
              Effets avancés
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {advancedTransitions.map((item) => {
                const isSelected = config.sceneTransition === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleApplyGlobalTransition(item.id)}
                    className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                      isSelected
                        ? 'border-[#D4A853]/70 bg-[#D4A853]/[0.12] text-[#F5E6C8]'
                        : 'border-white/[0.07] bg-[#141419] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className={
                        isSelected ? 'text-[#D4A853]' : 'text-zinc-500'
                      }
                    >
                      <TransitionIcon style={item.id} size="sm" />
                    </span>
                    <span className="truncate">{item.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Transition duration slider */}
        <div className="pt-1">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label
              htmlFor="transition-duration-slider"
              className="font-medium text-zinc-300"
            >
              Durée de la transition
            </label>
            <span className="font-mono-tabular text-zinc-300">
              {config.transitionDuration.toFixed(1)} s
            </span>
          </div>
          <input
            id="transition-duration-slider"
            type="range"
            min={0.4}
            max={1.8}
            step={0.1}
            value={config.transitionDuration}
            onChange={(e) =>
              onUpdateConfig({ transitionDuration: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Section 2: Verse-by-verse sequence editor + per-cut transition overrides */}
      <section aria-labelledby="decoupage-versets-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2
              id="decoupage-versets-heading"
              className="text-sm font-semibold text-zinc-100"
            >
              Découpage des versets
            </h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              <span className="font-mono-tabular">{verses.length}</span> versets · Durée totale{' '}
              <span className="font-mono-tabular text-zinc-200">
                {formatTimecode(totalDuration)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onResetDurations}
              title="Réinitialiser les durées synchronisées"
              aria-label="Réinitialiser les durées synchronisées"
              className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#141419] px-2.5 py-1.5 text-xs text-zinc-300 hover:border-white/[0.2] hover:text-white cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Auto</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSrt}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#141419] px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:border-[#D4A853]/50 hover:text-[#F5E6C8] whitespace-nowrap cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
              <span>SRT</span>
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          {segments.map((seg) => {
            const isCurrent = seg.index === activeVerseIndex;
            const v = seg.verse;
            const hasNextVerse = seg.index < segments.length - 1;

            return (
              <div key={v.id}>
                <div
                  className={`rounded-xl border p-3.5 transition-colors duration-150 ${
                    isCurrent
                      ? 'border-[#D4A853]/60 bg-[#D4A853]/[0.07]'
                      : 'border-white/[0.08] bg-[#141419]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onJumpToVerse(seg.index)}
                      className="text-left text-xs font-semibold text-zinc-200 hover:text-[#D4A853] cursor-pointer"
                    >
                      Verset {v.ayahNumber}{' '}
                      <span className="font-mono-tabular font-normal text-zinc-500">
                        · {formatTimecode(seg.startTime)} – {formatTimecode(seg.endTime)}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <label
                        htmlFor={`dur-${v.id}`}
                        className="text-[11px] text-zinc-400"
                      >
                        Durée
                      </label>
                      <input
                        id={`dur-${v.id}`}
                        type="number"
                        min={1.5}
                        max={25}
                        step={0.5}
                        value={v.duration}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isFinite(val)) {
                            onUpdateVerse(seg.index, {
                              duration: Math.max(1.5, Math.min(25, val)),
                            });
                          }
                        }}
                        className="font-mono-tabular w-16 rounded-md border border-white/[0.1] bg-[#0D0D11] px-2 py-1 text-right text-xs text-zinc-100 focus:border-[#D4A853] focus:outline-none"
                      />
                      <span className="text-[11px] text-zinc-500">s</span>
                    </div>
                  </div>

                  <p
                    dir="rtl"
                    className="font-arabic mt-2.5 text-right text-base leading-relaxed text-[#F5E6C8]"
                  >
                    {v.arabic}
                  </p>

                  <div className="mt-2">
                    <label htmlFor={`sub-${v.id}`} className="sr-only">
                      Sous-titre du verset {v.ayahNumber}
                    </label>
                    <textarea
                      id={`sub-${v.id}`}
                      rows={2}
                      value={editingEnglish ? v.english : v.french}
                      onChange={(e) =>
                        onUpdateVerse(
                          seg.index,
                          editingEnglish
                            ? { english: e.target.value }
                            : { french: e.target.value }
                        )
                      }
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-[#0D0D11] px-2.5 py-2 text-xs leading-relaxed text-zinc-200 focus:border-[#D4A853] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Inline scene cut connector between consecutive verses */}
                {hasNextVerse && (
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-zinc-400">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="h-3 w-[1px] bg-white/[0.16] ml-2"
                      />
                      <label htmlFor={`cut-${v.id}`} className="sr-only">
                        Transition après le verset {v.ayahNumber}
                      </label>
                      <select
                        id={`cut-${v.id}`}
                        value={v.transitionOut ?? 'default'}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateVerse(seg.index, {
                            transitionOut:
                              val === 'default'
                                ? undefined
                                : (val as SceneTransitionStyle),
                          });
                        }}
                        className="rounded-md border border-white/[0.08] bg-[#0D0D11] px-2 py-1 text-[11px] text-zinc-300 focus:border-[#D4A853] focus:outline-none cursor-pointer"
                      >
                        <option value="default" className="bg-[#121216]">
                          Transition globale ({SCENE_TRANSITIONS.find((t) => t.id === config.sceneTransition)?.name ?? 'Fondu'})
                        </option>
                        {SCENE_TRANSITIONS.map((t) => (
                          <option key={t.id} value={t.id} className="bg-[#121216]">
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => onPreviewTransitionAtCut(seg.index)}
                      aria-label={`Prévisualiser la transition après le verset ${v.ayahNumber}`}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-[#D4A853] whitespace-nowrap cursor-pointer"
                    >
                      <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                      <span>Voir</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
