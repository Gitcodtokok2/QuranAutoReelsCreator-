import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileText, Loader2, X } from 'lucide-react';
import {
  ExportHistoryItem,
  ExportResolution,
  SceneAsset,
  StudioConfig,
  VerseItem,
} from '../types/studio';
import { RECITERS, STYLE_PRESETS } from '../data/quranLibrary';
import { LoadedMediaMap } from '../utils/canvasRenderer';
import { StitchedRecitation } from '../utils/audioEngine';
import {
  computeTimelineSegments,
  formatTimecode,
  generateSrtSubtitles,
} from '../utils/timeline';
import { exportQuranVideo, ExportResult } from '../utils/videoExporter';

interface ExportModalProps {
  isOpen: boolean;
  verses: VerseItem[];
  scenes: SceneAsset[];
  mediaMap: LoadedMediaMap;
  config: StudioConfig;
  stitchedRecitation: StitchedRecitation | null;
  onRecordExport?: (entry: ExportHistoryItem) => void;
  onClose: () => void;
}

export function ExportModal({
  isOpen,
  verses,
  scenes,
  mediaMap,
  config,
  stitchedRecitation,
  onRecordExport,
  onClose,
}: ExportModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [includeAudio, setIncludeAudio] = useState<boolean>(config.audioEnabled);
  const [status, setStatus] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { totalDuration } = computeTimelineSegments(verses);

  useEffect(() => {
    if (!isOpen) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
      setStatus('idle');
      setProgress(0);
      setProgressLabel('');
      setErrorMsg(null);
      setResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const surahSlug =
    verses[0]?.surahNameFr.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? 'coran';
  const fileName = `noorreel-${surahSlug}-${resolution}.${result?.extension ?? 'webm'}`;

  const handleStartExport = async () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
      setResult(null);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('recording');
    setProgress(0.02);
    setProgressLabel('Préparation du moteur de rendu…');
    setErrorMsg(null);

    try {
      const exported = await exportQuranVideo({
        verses,
        scenes,
        mediaMap,
        config,
        resolution,
        includeAudio,
        stitchedRecitation,
        onProgress: (frac, label) => {
          setProgress(frac);
          setProgressLabel(label);
        },
        signal: controller.signal,
      });
      setResult(exported);
      setStatus('done');
      setProgress(1);
      if (onRecordExport && verses.length > 0) {
        const reciter = RECITERS.find((r) => r.id === config.reciterId);
        const style = STYLE_PRESETS.find((s) => s.id === config.activePresetId);
        onRecordExport({
          id: `exp-${Date.now()}`,
          exportedAt: new Date().toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          surahLabel: `Sourate ${verses[0].surahNameFr} (${verses[0].surahNumber}:${verses[0].ayahNumber}–${verses[verses.length - 1].ayahNumber})`,
          reciterName: reciter?.name ?? config.reciterId,
          styleName: style?.name ?? config.layoutMode,
          resolution,
          format: 'video',
          durationSec: Math.round(totalDuration),
        });
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle');
        setProgress(0);
        return;
      }
      setErrorMsg(
        err instanceof Error ? err.message : 'Erreur lors de la génération vidéo.'
      );
      setStatus('error');
    }
  };

  const handleCancelRecording = () => {
    abortRef.current?.abort();
  };

  const handleDownloadVideo = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtSubtitles(verses, config.subtitleLanguage);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noorreel-${surahSlug}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (onRecordExport && verses.length > 0) {
      const reciter = RECITERS.find((r) => r.id === config.reciterId);
      const style = STYLE_PRESETS.find((s) => s.id === config.activePresetId);
      onRecordExport({
        id: `srt-${Date.now()}`,
        exportedAt: new Date().toLocaleString('fr-FR', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        surahLabel: `Sourate ${verses[0].surahNameFr} (${verses[0].surahNumber}:${verses[0].ayahNumber}–${verses[verses.length - 1].ayahNumber})`,
        reciterName: reciter?.name ?? config.reciterId,
        styleName: style?.name ?? config.layoutMode,
        resolution: 'SRT',
        format: 'srt',
        durationSec: Math.round(totalDuration),
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#121216] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="export-modal-title"
              className="font-display text-lg font-semibold text-zinc-100"
            >
              Exporter la vidéo verticale
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              Format 9:16 prêt pour TikTok, Instagram Reels et YouTube Shorts ·{' '}
              <span className="font-mono-tabular text-zinc-200">
                {formatTimecode(totalDuration)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre d'export"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 space-y-5">
          {status === 'idle' || status === 'error' ? (
            <>
              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-300">
                  Qualité d’export
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setResolution('720p')}
                    className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      resolution === '720p'
                        ? 'border-[#D4A853] bg-[#D4A853]/10'
                        : 'border-white/[0.08] bg-[#18181E] hover:border-white/[0.16]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-100 whitespace-nowrap">HD 720p</p>
                    <p className="mt-0.5 font-mono-tabular text-[10px] text-zinc-400 whitespace-nowrap">
                      720 × 1280
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution('1080p')}
                    className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      resolution === '1080p'
                        ? 'border-[#D4A853] bg-[#D4A853]/10'
                        : 'border-white/[0.08] bg-[#18181E] hover:border-white/[0.16]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-100 whitespace-nowrap">Full HD</p>
                    <p className="mt-0.5 font-mono-tabular text-[10px] text-zinc-400 whitespace-nowrap">
                      1080 × 1920
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResolution('4k')}
                    className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      resolution === '4k'
                        ? 'border-[#D4A853] bg-[#D4A853]/10'
                        : 'border-white/[0.08] bg-[#18181E] hover:border-white/[0.16]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-100 whitespace-nowrap">4K UHD</p>
                    <p className="mt-0.5 font-mono-tabular text-[10px] text-zinc-400 whitespace-nowrap">
                      2160 × 3840
                    </p>
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-[#18181E] px-4 py-3 text-xs text-zinc-200 cursor-pointer">
                <span>Inclure la récitation audio dans la vidéo</span>
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="h-4 w-4 accent-[#D4A853] cursor-pointer"
                />
              </label>

              {errorMsg && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
                >
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleStartExport}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#D4A853] px-4 py-2.5 text-sm font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] cursor-pointer"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Générer la vidéo</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/[0.12] bg-[#1B1B22] px-3.5 py-2.5 text-xs font-medium text-zinc-200 hover:border-white/[0.25] whitespace-nowrap cursor-pointer"
                >
                  <FileText className="h-4 w-4 text-[#D4A853]" aria-hidden="true" />
                  <span>SRT</span>
                </button>
              </div>
            </>
          ) : status === 'recording' ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-2 text-zinc-200">
                  <Loader2 className="h-4 w-4 animate-spin text-[#D4A853]" aria-hidden="true" />
                  {progressLabel}
                </span>
                <span className="font-mono-tabular font-medium text-[#D4A853]">
                  {Math.round(progress * 100)}%
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#D4A853] transition-all duration-150"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>

              <p className="text-xs leading-relaxed text-zinc-400">
                L’enregistrement s’effectue directement dans votre navigateur en temps réel ({formatTimecode(totalDuration)}). Gardez cet onglet ouvert jusqu’à la fin.
              </p>

              <button
                type="button"
                onClick={handleCancelRecording}
                className="w-full rounded-lg border border-white/[0.12] bg-[#1B1B22] px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.08] hover:text-white cursor-pointer"
              >
                Annuler l’export
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Votre vidéo est prête
                  </p>
                  <p className="mt-1 text-xs text-zinc-300">
                    Résolution {resolution} ·{' '}
                    <span className="font-mono-tabular">
                      {result ? (result.blob.size / (1024 * 1024)).toFixed(1) : '0.0'} Mo
                    </span>{' '}
                    · Prête à publier sur TikTok et Reels.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#D4A853] px-4 py-2.5 text-sm font-semibold text-[#09090B] transition-colors hover:bg-[#e2ba6a] cursor-pointer"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>Télécharger {fileName}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadSrt}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.12] bg-[#1B1B22] px-4 py-2 text-xs font-medium text-zinc-200 hover:border-white/[0.25] cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-[#D4A853]" aria-hidden="true" />
                  <span>Télécharger aussi les sous-titres (.srt)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
