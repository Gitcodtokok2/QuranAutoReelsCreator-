import { FormEvent, useState } from 'react';
import { Loader2, Volume2, VolumeX } from 'lucide-react';
import {
  EDITORIAL_MOODS,
  PRESET_PASSAGES,
  RECITERS,
  SURAH_LIST,
} from '../data/quranLibrary';
import { fetchSurahVerses } from '../services/quranApi';
import {
  EditorialMoodSuggestion,
  EditorialThemeId,
  StudioConfig,
  SubtitleLanguage,
  VerseItem,
} from '../types/studio';
import { validateSurahRange } from '../utils/timeline';

interface PassagesPanelProps {
  activePassageId: string;
  activeEditorialMood: EditorialThemeId | null;
  config: StudioConfig;
  onSelectPresetPassage: (passageId: string, verses: VerseItem[]) => void;
  onLoadCustomVerses: (label: string, verses: VerseItem[]) => void;
  onApplyEditorialMood: (mood: EditorialMoodSuggestion) => void;
  onUpdateConfig: (patch: Partial<StudioConfig>) => void;
}

const LANGUAGE_OPTIONS: { id: SubtitleLanguage; label: string }[] = [
  { id: 'ar-fr', label: 'Arabe + FR' },
  { id: 'ar-en', label: 'Arabe + EN' },
  { id: 'ar-fr-en', label: 'Trilingue (AR+FR+EN)' },
  { id: 'ar-only', label: 'Arabe seul' },
  { id: 'fr-only', label: 'FR seul' },
];

export function PassagesPanel({
  activePassageId,
  activeEditorialMood,
  config,
  onSelectPresetPassage,
  onLoadCustomVerses,
  onApplyEditorialMood,
  onUpdateConfig,
}: PassagesPanelProps) {
  const [selectedSurah, setSelectedSurah] = useState<number>(55);
  const [fromAyah, setFromAyah] = useState<string>('1');
  const [toAyah, setToAyah] = useState<string>('8');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentSurahMeta =
    SURAH_LIST.find((s) => s.number === selectedSurah) ?? SURAH_LIST[0];

  const hafsReciters = RECITERS.filter((r) => r.tradition === 'Hafs');
  const warshReciters = RECITERS.filter((r) => r.tradition === 'Warsh');

  const handleSurahChange = (surahNum: number) => {
    setSelectedSurah(surahNum);
    const meta = SURAH_LIST.find((s) => s.number === surahNum);
    const maxDefault = Math.min(meta?.ayahCount ?? 7, 8);
    setFromAyah('1');
    setToAyah(String(maxDefault));
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleLoadSurah = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const parsedFrom = Number.parseInt(fromAyah, 10);
    const parsedTo = Number.parseInt(toAyah, 10);

    const validation = validateSurahRange(
      parsedFrom,
      parsedTo,
      currentSurahMeta.ayahCount,
      20
    );

    if (validation.error) {
      setErrorMsg(validation.error);
      return;
    }

    setIsLoading(true);
    try {
      const loaded = await fetchSurahVerses(
        selectedSurah,
        validation.from,
        validation.to
      );
      onLoadCustomVerses(
        `custom-${selectedSurah}-${validation.from}-${validation.to}`,
        loaded
      );
      setSuccessMsg(
        `Sourate ${currentSurahMeta.nameFr} (${validation.from}–${validation.to}) chargée.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Impossible de charger cette sourate.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* Section 1: Editorial Atmosphere Suggestion Bar */}
      <section aria-labelledby="ambiances-heading">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2
            id="ambiances-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Ambiances par thème
          </h2>
          <span className="text-xs text-zinc-500">Direction artistique</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {EDITORIAL_MOODS.map((mood) => {
            const isActive = activeEditorialMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => onApplyEditorialMood(mood)}
                title={mood.atmosphere}
                className={`rounded-lg border px-3 py-2 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                  isActive
                    ? 'border-[#D4A853]/70 bg-[#D4A853]/12 text-zinc-50'
                    : 'border-white/[0.07] bg-[#141419] text-zinc-300 hover:border-white/[0.16] hover:text-zinc-100'
                }`}
              >
                <div className="text-xs font-medium">{mood.label}</div>
                <div className="mt-0.5 truncate text-[11px] text-zinc-400">
                  {mood.atmosphere}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Section 2: Curated passages */}
      <section aria-labelledby="passages-populaires-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            id="passages-populaires-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Passages populaires
          </h2>
          <span className="text-xs text-zinc-500">Prêts à générer</span>
        </div>

        <div className="space-y-2">
          {PRESET_PASSAGES.map((passage) => {
            const isSelected = activePassageId === passage.id;
            return (
              <button
                key={passage.id}
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  onSelectPresetPassage(passage.id, passage.verses);
                }}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
                  isSelected
                    ? 'border-[#D4A853]/60 bg-[#D4A853]/[0.08]'
                    : 'border-white/[0.07] bg-[#141419] hover:border-white/[0.15] hover:bg-[#191920]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-zinc-100">
                    {passage.title}
                  </span>
                  <span
                    className="font-arabic text-base text-[#D4A853]"
                    dir="rtl"
                  >
                    {passage.surahNameAr}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                  <span className="whitespace-nowrap shrink-0">
                    {passage.rangeLabel}
                  </span>
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                  <span className="truncate">{passage.themeNote}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Section 3: Any Surah 1-114 loader */}
      <section aria-labelledby="toutes-sourates-heading">
        <div className="mb-3">
          <h2
            id="toutes-sourates-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            Choisir une sourate complète
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Texte arabe Uthmani et traductions authentiques (114 sourates)
          </p>
        </div>

        <form onSubmit={handleLoadSurah} className="space-y-3" noValidate>
          <div>
            <label
              htmlFor="surah-select"
              className="mb-1.5 block text-xs font-medium text-zinc-300"
            >
              Sourate
            </label>
            <select
              id="surah-select"
              value={selectedSurah}
              onChange={(e) => handleSurahChange(Number(e.target.value))}
              className="w-full rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2.5 text-sm text-zinc-100 focus:border-[#D4A853] focus:outline-none"
            >
              {SURAH_LIST.map((surah) => (
                <option
                  key={surah.number}
                  value={surah.number}
                  className="bg-[#121216] text-zinc-100"
                >
                  {surah.number}. {surah.nameFr} — {surah.nameAr} ({surah.ayahCount} v.)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="ayah-from"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Verset de début
              </label>
              <input
                id="ayah-from"
                type="number"
                min={1}
                max={currentSurahMeta.ayahCount}
                value={fromAyah}
                onChange={(e) => setFromAyah(e.target.value)}
                className="font-mono-tabular w-full rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2 text-sm text-zinc-100 focus:border-[#D4A853] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="ayah-to"
                className="mb-1.5 block text-xs font-medium text-zinc-300"
              >
                Verset de fin
              </label>
              <input
                id="ayah-to"
                type="number"
                min={1}
                max={currentSurahMeta.ayahCount}
                value={toAyah}
                onChange={(e) => setToAyah(e.target.value)}
                className="font-mono-tabular w-full rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2 text-sm text-zinc-100 focus:border-[#D4A853] focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {errorMsg}
            </p>
          )}

          {successMsg && (
            <p
              role="status"
              className="rounded-lg border border-[#D4A853]/30 bg-[#D4A853]/10 px-3 py-2 text-xs text-amber-100"
            >
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-[#1B1B22] px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors duration-150 hover:border-[#D4A853]/50 hover:bg-[#22222B] disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
          >
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            <span>
              {isLoading ? 'Chargement des versets…' : 'Charger ces versets'}
            </span>
          </button>
        </form>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Section 4: Audio reciter (Hafs + Warsh) & Subtitle language */}
      <section aria-labelledby="recitation-langue-heading" className="space-y-4">
        <h2
          id="recitation-langue-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Récitation et langues
        </h2>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Affichage du texte sur la vidéo
          </label>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-white/[0.07] bg-[#141419] p-1">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = config.subtitleLanguage === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateConfig({ subtitleLanguage: opt.id })}
                  className={`rounded-md px-2.5 py-2 text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    opt.id === 'ar-fr-en' ? 'col-span-2' : ''
                  } ${
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
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="reciter-select"
              className="text-xs font-medium text-zinc-300"
            >
              Récitateur audio (Hafs & Warsh)
            </label>
            <button
              type="button"
              onClick={() =>
                onUpdateConfig({ audioEnabled: !config.audioEnabled })
              }
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 cursor-pointer"
              aria-pressed={config.audioEnabled}
            >
              {config.audioEnabled ? (
                <>
                  <Volume2
                    className="h-3.5 w-3.5 text-[#D4A853]"
                    aria-hidden="true"
                  />
                  <span>Audio activé</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Muet</span>
                </>
              )}
            </button>
          </div>
          <select
            id="reciter-select"
            value={config.reciterId}
            onChange={(e) => onUpdateConfig({ reciterId: e.target.value })}
            disabled={!config.audioEnabled}
            className="w-full rounded-lg border border-white/[0.1] bg-[#141419] px-3 py-2.5 text-sm text-zinc-100 focus:border-[#D4A853] focus:outline-none disabled:opacity-45"
          >
            <optgroup
              label={`Lecture Hafs ’an ’Asim (${hafsReciters.length})`}
              className="bg-[#121216] text-zinc-300"
            >
              {hafsReciters.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                  className="bg-[#121216] text-zinc-100"
                >
                  {r.name} — {r.style}
                </option>
              ))}
            </optgroup>
            <optgroup
              label={`Lecture Warsh ’an Nafi’ (${warshReciters.length})`}
              className="bg-[#121216] text-zinc-300"
            >
              {warshReciters.map((r) => (
                <option
                  key={r.id}
                  value={r.id}
                  className="bg-[#121216] text-zinc-100"
                >
                  {r.name} — {r.style}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Mode répétition / mémorisation (Hifz) */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-300">
            Répétition par verset (mémorisation / Hifz)
          </label>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-white/[0.07] bg-[#141419] p-1">
            {([
              { value: 1, label: '1× Normal' },
              { value: 2, label: '2× Étude' },
              { value: 3, label: '3× Hifz' },
            ] as const).map((opt) => {
              const active = config.memorizationRepeat === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateConfig({ memorizationRepeat: opt.value })}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
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
        </div>
      </section>
    </div>
  );
}
