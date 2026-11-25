import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_SCENES,
  DEFAULT_STUDIO_CONFIG,
  PRESET_PASSAGES,
  RECITERS,
  STYLE_PRESETS,
  SURAH_LIST,
} from './data/quranLibrary';
import { AutomationView } from './components/AutomationView';
import { ExportModal } from './components/ExportModal';
import { LibraryView } from './components/LibraryView';
import { PassagesPanel } from './components/PassagesPanel';
import { SequencesPanel } from './components/SequencesPanel';
import { StylePanel } from './components/StylePanel';
import { TopBar } from './components/TopBar';
import { VideoPreviewStage } from './components/VideoPreviewStage';
import { VisualsPanel } from './components/VisualsPanel';
import { fetchSurahVerses } from './services/quranApi';
import {
  ArabicFontFamily,
  AudioSyncStatus,
  CampaignConfig,
  EditorialMoodSuggestion,
  EditorialThemeId,
  ExportHistoryItem,
  SceneAsset,
  SceneTransitionStyle,
  ScheduledVideoItem,
  StudioConfig,
  StudioTab,
  StylePreset,
  TextAnimationStyle,
  VerseItem,
  WorkspaceModule,
} from './types/studio';
import {
  loadAndStitchRecitation,
  StitchedRecitation,
} from './utils/audioEngine';
import {
  DEFAULT_CAMPAIGN_CONFIG,
  generateCampaignSchedule,
} from './utils/campaignEngine';
import { LoadedMediaMap } from './utils/canvasRenderer';
import {
  computeTimelineSegments,
  estimateVerseDuration,
  expandVersesForMemorization,
} from './utils/timeline';

const STUDIO_INSPECTOR_TABS: { id: StudioTab; label: string }[] = [
  { id: 'passages', label: 'Passages' },
  { id: 'visuals', label: 'Visuels' },
  { id: 'typography', label: 'Style' },
  { id: 'sequences', label: 'Séquences' },
];

const CUSTOM_STYLES_STORAGE_KEY = 'noorreel_custom_styles_v1';
const EXPORT_HISTORY_STORAGE_KEY = 'noorreel_export_history_v1';

function loadSavedExportHistory(): ExportHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(EXPORT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadSavedCustomStyles(): StylePreset[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_STYLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeModule, setActiveModule] = useState<WorkspaceModule>('studio');
  const [activeTab, setActiveTab] = useState<StudioTab>('passages');
  const [activeEditorialMood, setActiveEditorialMood] =
    useState<EditorialThemeId | null>(PRESET_PASSAGES[0].editorialTheme);

  const [activePassageId, setActivePassageId] = useState<string>(
    PRESET_PASSAGES[0].id
  );
  const [verses, setVerses] = useState<VerseItem[]>(PRESET_PASSAGES[0].verses);
  const [scenes, setScenes] = useState<SceneAsset[]>(DEFAULT_SCENES);
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [customStyles, setCustomStyles] = useState<StylePreset[]>(() =>
    loadSavedCustomStyles()
  );

  // Automation engine state
  const [campaignConfig, setCampaignConfig] = useState<CampaignConfig>(
    DEFAULT_CAMPAIGN_CONFIG
  );
  const [schedule, setSchedule] = useState<ScheduledVideoItem[]>(() =>
    generateCampaignSchedule(
      DEFAULT_CAMPAIGN_CONFIG,
      [...loadSavedCustomStyles(), ...STYLE_PRESETS],
      RECITERS,
      SURAH_LIST,
      PRESET_PASSAGES
    )
  );
  const [loadingSlotId, setLoadingSlotId] = useState<string | null>(null);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(() =>
    loadSavedExportHistory()
  );

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(1.8);
  const [seekVersion, setSeekVersion] = useState<number>(0);
  const [activeVerseIndex, setActiveVerseIndex] = useState<number>(0);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Expanded verse sequence honoring memorizationRepeat (1x, 2x, 3x)
  const effectiveVerses = useMemo(
    () => expandVersesForMemorization(verses, config.memorizationRepeat),
    [verses, config.memorizationRepeat]
  );

  // Persist custom styles in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CUSTOM_STYLES_STORAGE_KEY,
        JSON.stringify(customStyles)
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [customStyles]);

  // Persist export history in localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(
        EXPORT_HISTORY_STORAGE_KEY,
        JSON.stringify(exportHistory.slice(0, 40))
      );
    } catch {
      // Ignore storage quota errors gracefully
    }
  }, [exportHistory]);

  const allStyles = useMemo(
    () => [...customStyles, ...STYLE_PRESETS],
    [customStyles]
  );

  // Gapless master audio recitation state
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [stitchedRecitation, setStitchedRecitation] =
    useState<StitchedRecitation | null>(null);
  const [audioSyncStatus, setAudioSyncStatus] =
    useState<AudioSyncStatus>('idle');

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  }, []);

  // Keep latest expanded verses ref for audio loader without re-triggering on manual text edits
  const versesRef = useRef(effectiveVerses);
  versesRef.current = effectiveVerses;

  // Automatically preload, trim dead air, and stitch a single continuous audio track
  useEffect(() => {
    const controller = new AbortController();
    const currentVerses = versesRef.current;
    if (currentVerses.length === 0) return;

    setAudioSyncStatus('syncing');
    setStitchedRecitation(null);

    const run = async () => {
      try {
        const ctx = getAudioContext();
        const stitched = await loadAndStitchRecitation(
          ctx,
          currentVerses,
          config.reciterId,
          controller.signal
        );
        if (controller.signal.aborted) return;

        setStitchedRecitation(stitched);
        setAudioSyncStatus('synced');

        setVerses((prev) => {
          const repeat = config.memorizationRepeat;
          if (prev.length * repeat !== stitched.verseDurations.length) {
            return prev;
          }
          return prev.map((v, idx) => ({
            ...v,
            duration: stitched.verseDurations[idx * repeat],
          }));
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAudioSyncStatus('fallback');
      }
    };

    run();
    return () => {
      controller.abort();
    };
  }, [activePassageId, config.reciterId, config.memorizationRepeat, getAudioContext]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Preload all scene images & custom videos into an offscreen HTMLMedia map
  const mediaMapRef = useRef<LoadedMediaMap>(new Map());
  const [mediaVersion, setMediaVersion] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const map = mediaMapRef.current;

    scenes.forEach((scene) => {
      if (scene.type === 'generative' || map.has(scene.id)) return;

      if (scene.type === 'image') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (mounted) setMediaVersion((v) => v + 1);
        };
        img.src = scene.url;
        map.set(scene.id, img);
      } else {
        const video = document.createElement('video');
        video.src = scene.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.onloadeddata = () => {
          video.play().catch(() => {});
          if (mounted) setMediaVersion((v) => v + 1);
        };
        map.set(scene.id, video);
      }
    });

    return () => {
      mounted = false;
    };
  }, [scenes]);

  // Support ?autostart=1 to begin smooth playback immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setIsPlaying(true);
    }
  }, []);

  // Pause studio playback cleanly when navigating away from Studio
  const handleSelectModule = useCallback((mod: WorkspaceModule) => {
    if (mod !== 'studio') {
      setIsPlaying(false);
    }
    setActiveModule(mod);
  }, []);

  const handleUpdateConfig = useCallback(
    (patch: Partial<StudioConfig>) => {
      setConfig((prev) => {
        const next = { ...prev, ...patch };
        if (patch.activeSceneId && next.autoCycleScenes && !isPlaying) {
          setCurrentTime(1.2);
          setActiveVerseIndex(0);
        }
        return next;
      });
    },
    [isPlaying]
  );

  const handleApplyPreset = useCallback((preset: StylePreset) => {
    setConfig((prev) => ({
      ...prev,
      activePresetId: preset.id,
      layoutMode: preset.layoutMode,
      activeSceneId: preset.recommendedSceneId || prev.activeSceneId,
      sceneTransition: preset.recommendedTransition || prev.sceneTransition,
      arabicColor: preset.arabicColor,
      translationColor: preset.translationColor,
      accentColor: preset.accentColor,
      scrimOpacity: preset.scrimOpacity,
      particleEffect: preset.particleEffect,
      textAnimation: preset.textAnimation,
      translationFont: preset.translationFont,
      arabicFont: preset.arabicFont ?? prev.arabicFont,
      arabicFontSize: preset.arabicFontSize ?? 62,
      translationFontSize: preset.translationFontSize ?? 32,
      verticalPosition: preset.verticalPosition ?? 0.5,
      showOrnament: preset.showOrnament,
      showAudioWave: preset.showAudioWave,
      autoCycleScenes:
        preset.layoutMode === 'light-editorial' || preset.layoutMode === 'mushaf-frame'
          ? false
          : prev.autoCycleScenes,
    }));
  }, []);

  const handleUseStyleFromLibrary = useCallback(
    (preset: StylePreset) => {
      handleApplyPreset(preset);
      setActiveModule('studio');
      setActiveTab('typography');
    },
    [handleApplyPreset]
  );

  const handleSaveCustomStyle = useCallback(
    (name: string) => {
      const id = `custom-style-${Date.now()}`;
      const newPreset: StylePreset = {
        id,
        name,
        family: 'minimal',
        layoutMode: config.layoutMode,
        description: 'Modèle personnalisé créé dans le Studio',
        recommendedSceneId: config.activeSceneId,
        recommendedTransition: config.sceneTransition,
        arabicColor: config.arabicColor,
        translationColor: config.translationColor,
        accentColor: config.accentColor,
        scrimOpacity: config.scrimOpacity,
        particleEffect: config.particleEffect,
        textAnimation: config.textAnimation,
        translationFont: config.translationFont,
        arabicFont: config.arabicFont,
        arabicFontSize: config.arabicFontSize,
        translationFontSize: config.translationFontSize,
        verticalPosition: config.verticalPosition,
        showOrnament: config.showOrnament,
        showAudioWave: config.showAudioWave,
        isCustom: true,
      };
      setCustomStyles((prev) => [newPreset, ...prev]);
      setConfig((prev) => ({ ...prev, activePresetId: id }));
    },
    [config]
  );

  const handleDeleteCustomStyle = useCallback((styleId: string) => {
    setCustomStyles((prev) => prev.filter((s) => s.id !== styleId));
  }, []);

  const handleApplyEditorialMood = useCallback(
    (mood: EditorialMoodSuggestion) => {
      setActiveEditorialMood(mood.id);
      const matchedPreset = allStyles.find((s) => s.id === mood.presetId);
      if (matchedPreset) {
        handleApplyPreset({
          ...matchedPreset,
          recommendedSceneId: mood.sceneId,
          recommendedTransition: mood.transition,
        });
      } else {
        setConfig((prev) => ({
          ...prev,
          activeSceneId: mood.sceneId,
          sceneTransition: mood.transition,
        }));
      }
    },
    [allStyles, handleApplyPreset]
  );

  const handleSelectPresetPassage = useCallback(
    (passageId: string, newVerses: VerseItem[]) => {
      const meta = PRESET_PASSAGES.find((p) => p.id === passageId);
      if (meta) setActiveEditorialMood(meta.editorialTheme);
      versesRef.current = expandVersesForMemorization(
        newVerses,
        config.memorizationRepeat
      );
      setVerses(newVerses);
      setActivePassageId(passageId);
      setCurrentTime(0.05);
      setActiveVerseIndex(0);
      setStudioNotice(null);
    },
    [config.memorizationRepeat]
  );

  const handleLoadCustomVerses = useCallback(
    (passageKey: string, loadedVerses: VerseItem[]) => {
      versesRef.current = expandVersesForMemorization(
        loadedVerses,
        config.memorizationRepeat
      );
      setVerses(loadedVerses);
      setActivePassageId(passageKey);
      setCurrentTime(0.05);
      setActiveVerseIndex(0);
      setStudioNotice(null);
    },
    [config.memorizationRepeat]
  );

  const handleAddCustomScene = useCallback((file: File) => {
    const objectUrl = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const newScene: SceneAsset = {
      id: `custom-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || 'Média importé',
      mood: isVideo ? 'Vidéo personnelle' : 'Image personnelle',
      family: 'nature',
      type: isVideo ? 'video' : 'image',
      url: objectUrl,
      animationLayer: 'none',
      fallbackGradient: ['#18181b', '#27272a', '#09090b'],
      isCustom: true,
    };
    setScenes((prev) => [newScene, ...prev]);
    setConfig((prev) => ({
      ...prev,
      activeSceneId: newScene.id,
      autoCycleScenes: false,
    }));
  }, []);

  const handleRemoveCustomScene = useCallback((sceneId: string) => {
    setScenes((prev) => {
      const target = prev.find((s) => s.id === sceneId);
      if (target?.isCustom) {
        URL.revokeObjectURL(target.url);
      }
      const next = prev.filter((s) => s.id !== sceneId);
      const media = mediaMapRef.current.get(sceneId);
      if (media instanceof HTMLVideoElement) {
        media.pause();
        media.src = '';
      }
      mediaMapRef.current.delete(sceneId);
      setConfig((cfg) =>
        cfg.activeSceneId === sceneId
          ? { ...cfg, activeSceneId: next[0]?.id ?? DEFAULT_SCENES[0].id }
          : cfg
      );
      return next;
    });
  }, []);

  const handleJumpToVerse = useCallback(
    (index: number) => {
      const { segments } = computeTimelineSegments(effectiveVerses);
      const expandedIndex = index * config.memorizationRepeat;
      const seg = segments[expandedIndex] ?? segments[index];
      if (seg) {
        setCurrentTime(seg.startTime + 0.05);
        setSeekVersion((v) => v + 1);
        setActiveVerseIndex(expandedIndex);
      }
    },
    [effectiveVerses, config.memorizationRepeat]
  );

  const handlePreviewTransitionAtCut = useCallback(
    (verseIndex: number) => {
      const { segments } = computeTimelineSegments(effectiveVerses);
      const expandedIndex =
        verseIndex * config.memorizationRepeat + (config.memorizationRepeat - 1);
      const seg = segments[expandedIndex] ?? segments[verseIndex];
      if (!seg) return;
      setConfig((prev) =>
        prev.autoCycleScenes ? prev : { ...prev, autoCycleScenes: true }
      );
      const leadIn = Math.min(config.transitionDuration + 0.45, seg.duration * 0.7);
      const previewStart = Math.max(seg.startTime, seg.endTime - leadIn);
      setCurrentTime(previewStart);
      setSeekVersion((v) => v + 1);
      setActiveVerseIndex(expandedIndex);
      setIsPlaying(true);
    },
    [effectiveVerses, config.memorizationRepeat, config.transitionDuration]
  );

  const handleUpdateVerse = useCallback(
    (index: number, patch: Partial<VerseItem>) => {
      setVerses((prev) =>
        prev.map((v, idx) => (idx === index ? { ...v, ...patch } : v))
      );
    },
    []
  );

  const handleResetDurations = useCallback(() => {
    const repeat = config.memorizationRepeat;
    if (
      stitchedRecitation &&
      stitchedRecitation.verseDurations.length === verses.length * repeat
    ) {
      setVerses((prev) =>
        prev.map((v, idx) => ({
          ...v,
          duration: stitchedRecitation.verseDurations[idx * repeat],
        }))
      );
      return;
    }
    setVerses((prev) =>
      prev.map((v) => ({ ...v, duration: estimateVerseDuration(v.arabic) }))
    );
  }, [stitchedRecitation, verses.length, config.memorizationRepeat]);

  // Automation handlers
  const handleUpdateCampaignConfig = useCallback(
    (patch: Partial<CampaignConfig>) => {
      setCampaignConfig((prev) => ({ ...prev, ...patch }));
    },
    []
  );

  const handleToggleApproveSlot = useCallback((slotId: string) => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.id === slotId
          ? {
              ...item,
              status: item.status === 'approved' ? 'pending-review' : 'approved',
            }
          : item
      )
    );
  }, []);

  const handleApproveAllPending = useCallback(() => {
    setSchedule((prev) =>
      prev.map((item) =>
        item.quality.passed ? { ...item, status: 'approved' } : item
      )
    );
  }, []);

  const handleUpdateSlotCaption = useCallback(
    (slotId: string, caption: string, hashtags: string[]) => {
      setSchedule((prev) =>
        prev.map((item) =>
          item.id === slotId ? { ...item, caption, hashtags } : item
        )
      );
    },
    []
  );

  const handleOpenSlotInStudio = useCallback(
    async (slot: ScheduledVideoItem) => {
      setLoadingSlotId(slot.id);
      setStudioNotice(null);

      try {
        // 1. Load verses either from bundled curated presets or live Al-Quran API
        const presetMatch = PRESET_PASSAGES.find((p) => p.id === slot.passageId);
        let loadedVerses: VerseItem[];
        let passageKey: string;

        if (presetMatch) {
          loadedVerses = presetMatch.verses;
          passageKey = presetMatch.id;
        } else {
          loadedVerses = await fetchSurahVerses(
            slot.surahNumber,
            slot.fromAyah,
            slot.toAyah
          );
          passageKey = `scheduled-${slot.surahNumber}-${slot.fromAyah}-${slot.toAyah}`;
        }

        versesRef.current = loadedVerses;
        setVerses(loadedVerses);
        setActivePassageId(passageKey);

        // 2. Apply style, reciter, transition, animation, and language
        const styleMatch = allStyles.find((s) => s.id === slot.styleId);
        if (styleMatch) {
          handleApplyPreset(styleMatch);
        }
        setConfig((prev) => ({
          ...prev,
          reciterId: slot.reciterId,
          activeSceneId: slot.sceneId || prev.activeSceneId,
          sceneTransition: slot.transition,
          textAnimation: slot.textAnimation,
          subtitleLanguage: slot.subtitleLanguage,
        }));

        setCurrentTime(0.05);
        setSeekVersion((v) => v + 1);
        setActiveVerseIndex(0);
        setActiveModule('studio');
        setActiveTab('passages');
        setStudioNotice(
          `Vidéo planifiée chargée : Sourate ${slot.surahNameFr} (${slot.surahNumber}:${slot.fromAyah}–${slot.toAyah}) · ${slot.reciterName}.`
        );
      } catch {
        setStudioNotice(
          `Impossible de récupérer la sourate ${slot.surahNameFr} en ligne pour le moment.`
        );
      } finally {
        setLoadingSlotId(null);
      }
    },
    [allStyles, handleApplyPreset]
  );

  const handleOpenExport = useCallback(() => {
    setIsPlaying(false);
    setIsExportOpen(true);
  }, []);

  return (
    <div
      id="studio"
      className="flex min-h-screen flex-col bg-[#09090B] text-zinc-100"
    >
      <TopBar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        onOpenExport={handleOpenExport}
      />

      {/* MODULE 1: QURAN STUDIO */}
      {activeModule === 'studio' && (
        <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col-reverse lg:flex-row">
          {/* Left Studio Inspector Panel */}
          <aside
            aria-label="Réglages de la vidéo"
            className="w-full shrink-0 border-t border-white/[0.08] bg-[#0D0D11] lg:h-[calc(100vh-3.5rem)] lg:w-[420px] lg:overflow-y-auto lg:border-r lg:border-t-0"
          >
            {/* Sticky 4-tab Studio inspector navigation (Desktop & Mobile) */}
            <div
              role="tablist"
              aria-label="Onglets du studio"
              className="sticky top-0 z-10 grid grid-cols-4 gap-1 border-b border-white/[0.08] bg-[#0F0F14]/95 p-2 backdrop-blur-md"
            >
              {STUDIO_INSPECTOR_TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-md py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853] ${
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

            <div className="p-5 sm:p-6">
              {studioNotice && (
                <div
                  role="status"
                  className="mb-5 flex items-start justify-between gap-3 rounded-lg border border-[#D4A853]/35 bg-[#D4A853]/10 px-3.5 py-2.5 text-xs text-amber-100"
                >
                  <span>{studioNotice}</span>
                  <button
                    type="button"
                    onClick={() => setStudioNotice(null)}
                    className="text-zinc-400 hover:text-zinc-100 shrink-0 cursor-pointer"
                    aria-label="Fermer la notification"
                  >
                    ×
                  </button>
                </div>
              )}

              {activeTab === 'passages' && (
                <PassagesPanel
                  activePassageId={activePassageId}
                  activeEditorialMood={activeEditorialMood}
                  config={config}
                  onSelectPresetPassage={handleSelectPresetPassage}
                  onLoadCustomVerses={handleLoadCustomVerses}
                  onApplyEditorialMood={handleApplyEditorialMood}
                  onUpdateConfig={handleUpdateConfig}
                />
              )}

              {activeTab === 'visuals' && (
                <VisualsPanel
                  scenes={scenes}
                  config={config}
                  onUpdateConfig={handleUpdateConfig}
                  onAddCustomScene={handleAddCustomScene}
                  onRemoveCustomScene={handleRemoveCustomScene}
                />
              )}

              {activeTab === 'typography' && (
                <StylePanel
                  config={config}
                  verses={verses}
                  customStyles={customStyles}
                  onUpdateConfig={handleUpdateConfig}
                  onApplyPreset={handleApplyPreset}
                  onSaveCustomStyle={handleSaveCustomStyle}
                  onOpenLibrary={() => handleSelectModule('library')}
                />
              )}

              {activeTab === 'sequences' && (
                <SequencesPanel
                  verses={verses}
                  activeVerseIndex={Math.floor(activeVerseIndex / config.memorizationRepeat)}
                  config={config}
                  onJumpToVerse={(idx) => handleJumpToVerse(idx)}
                  onPreviewTransitionAtCut={handlePreviewTransitionAtCut}
                  onUpdateVerse={handleUpdateVerse}
                  onUpdateConfig={handleUpdateConfig}
                  onResetDurations={handleResetDurations}
                />
              )}
            </div>
          </aside>

          {/* Center/Right 9:16 Preview Stage */}
          <div className="flex flex-1 flex-col bg-[#09090B] lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
            <VideoPreviewStage
              verses={effectiveVerses}
              scenes={scenes}
              mediaMap={mediaMapRef.current}
              mediaVersion={mediaVersion}
              config={config}
              isPlaying={isPlaying}
              currentTime={currentTime}
              seekVersion={seekVersion}
              stitchedRecitation={stitchedRecitation}
              audioSyncStatus={audioSyncStatus}
              getAudioContext={getAudioContext}
              onSetIsPlaying={setIsPlaying}
              onSeek={(t) => {
                setCurrentTime(t);
                setSeekVersion((v) => v + 1);
              }}
              onActiveVerseChange={setActiveVerseIndex}
              onUpdateConfig={handleUpdateConfig}
            />
          </div>
        </main>
      )}

      {/* MODULE 2: QURAN LIBRARY */}
      {activeModule === 'library' && (
        <main className="flex-1 bg-[#09090B]">
          <LibraryView
            config={config}
            scenes={scenes}
            customStyles={customStyles}
            onUseStyleInStudio={handleUseStyleFromLibrary}
            onDeleteCustomStyle={handleDeleteCustomStyle}
            onSelectReciter={(reciterId) => {
              handleUpdateConfig({ reciterId, audioEnabled: true });
              setActiveModule('studio');
              setActiveTab('passages');
            }}
            onUseSceneInStudio={(sceneId) => {
              handleUpdateConfig({ activeSceneId: sceneId });
              setActiveModule('studio');
              setActiveTab('visuals');
            }}
            onApplyArabicFont={(font: ArabicFontFamily) => {
              handleUpdateConfig({ arabicFont: font });
              setActiveModule('studio');
              setActiveTab('typography');
            }}
            onApplyTextAnimation={(anim: TextAnimationStyle) => {
              handleUpdateConfig({ textAnimation: anim });
              setActiveModule('studio');
              setActiveTab('typography');
            }}
            onApplyTransition={(transition: SceneTransitionStyle) => {
              handleUpdateConfig({ sceneTransition: transition });
              setActiveModule('studio');
              setActiveTab('sequences');
            }}
          />
        </main>
      )}

      {/* MODULE 3: QURAN AUTOMATION */}
      {activeModule === 'automation' && (
        <main className="flex-1 bg-[#09090B]">
          <AutomationView
            campaignConfig={campaignConfig}
            schedule={schedule}
            customStyles={customStyles}
            exportHistory={exportHistory}
            isLoadingSlotId={loadingSlotId}
            onUpdateCampaignConfig={handleUpdateCampaignConfig}
            onReplaceSchedule={setSchedule}
            onToggleApproveSlot={handleToggleApproveSlot}
            onApproveAllPending={handleApproveAllPending}
            onUpdateSlotCaption={handleUpdateSlotCaption}
            onOpenSlotInStudio={handleOpenSlotInStudio}
          />
        </main>
      )}

      <ExportModal
        isOpen={isExportOpen}
        verses={effectiveVerses}
        scenes={scenes}
        mediaMap={mediaMapRef.current}
        config={config}
        stitchedRecitation={stitchedRecitation}
        onRecordExport={(entry) => setExportHistory((prev) => [entry, ...prev])}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
