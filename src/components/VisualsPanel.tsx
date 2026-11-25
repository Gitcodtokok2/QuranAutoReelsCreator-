import { ChangeEvent, useRef, useState } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { ParticleEffect, SceneAsset, StudioConfig } from '../types/studio';

interface VisualsPanelProps {
  scenes: SceneAsset[];
  config: StudioConfig;
  onUpdateConfig: (patch: Partial<StudioConfig>) => void;
  onAddCustomScene: (file: File) => void;
  onRemoveCustomScene: (sceneId: string) => void;
}

const PARTICLE_OPTIONS: { id: ParticleEffect; label: string }[] = [
  { id: 'gold-dust', label: 'Poussière dorée' },
  { id: 'gentle-rain', label: 'Pluie fine' },
  { id: 'starlight', label: 'Scintillement' },
  { id: 'soft-mist', label: 'Brume douce' },
  { id: 'none', label: 'Aucun' },
];

export function VisualsPanel({
  scenes,
  config,
  onUpdateConfig,
  onAddCustomScene,
  onRemoveCustomScene,
}: VisualsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddCustomScene(file);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-7">
      {/* Auto-scroll multi-scene reel toggle */}
      <section aria-labelledby="auto-reel-heading">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#141419] p-4">
          <div>
            <h2
              id="auto-reel-heading"
              className="text-sm font-semibold text-zinc-100"
            >
              Défilement automatique des scènes
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Enchaîne automatiquement les paysages cinématiques avec fondu fluide à chaque verset.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.autoCycleScenes}
            aria-label="Activer le défilement automatique des scènes"
            onClick={() =>
              onUpdateConfig({ autoCycleScenes: !config.autoCycleScenes })
            }
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A853] ${
              config.autoCycleScenes ? 'bg-[#D4A853]' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-[#09090B] transition-transform duration-200 ${
                config.autoCycleScenes ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Scene gallery */}
      <section aria-labelledby="scenes-bibliotheque-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2
            id="scenes-bibliotheque-heading"
            className="text-sm font-semibold text-zinc-100"
          >
            {config.autoCycleScenes ? 'Scène de départ' : 'Arrière-plan fixe'}
          </h2>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#D4A853] hover:text-[#e6bf72] whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Importer média</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Importer une vidéo ou une image d'arrière-plan"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {scenes.map((scene) => {
            const isSelected = config.activeSceneId === scene.id;
            const hasError = brokenIds[scene.id];

            return (
              <div
                key={scene.id}
                className={`group relative overflow-hidden rounded-xl border transition-colors duration-150 ${
                  isSelected
                    ? 'border-[#D4A853] ring-1 ring-[#D4A853]/40'
                    : 'border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onUpdateConfig({ activeSceneId: scene.id })}
                  className="block w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A853]"
                >
                  <div
                    className="relative aspect-[9/12] w-full overflow-hidden"
                    style={{
                      background: `linear-gradient(180deg, ${scene.fallbackGradient[0]}, ${scene.fallbackGradient[1]}, ${scene.fallbackGradient[2]})`,
                    }}
                  >
                    {!hasError && scene.type === 'image' && (
                      <img
                        src={scene.url}
                        alt={scene.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenIds((prev) => ({ ...prev, [scene.id]: true }))
                        }
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    )}
                    {!hasError && scene.type === 'video' && (
                      <video
                        src={scene.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        className="h-full w-full object-cover"
                      />
                    )}
                    {scene.type === 'generative' && (
                      <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_50%_42%,rgba(212,168,83,0.22),rgba(11,18,38,0.92)_62%,#06060a_100%)]">
                        <svg
                          viewBox="0 0 120 120"
                          className="h-20 w-20 text-[#D4A853]/75 transition-transform duration-500 group-hover:rotate-12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          aria-hidden="true"
                        >
                          <circle cx="60" cy="60" r="42" strokeOpacity="0.45" />
                          <rect x="30" y="30" width="60" height="60" />
                          <rect
                            x="30"
                            y="30"
                            width="60"
                            height="60"
                            transform="rotate(45 60 60)"
                          />
                          <circle cx="60" cy="60" r="18" strokeOpacity="0.65" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-2.5">
                      <p className="truncate text-xs font-medium text-zinc-100">
                        {scene.name}
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        {scene.mood}
                      </p>
                    </div>
                  </div>
                </button>

                {scene.isCustom && (
                  <button
                    type="button"
                    aria-label={`Supprimer ${scene.name}`}
                    onClick={() => onRemoveCustomScene(scene.id)}
                    className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-zinc-300 hover:bg-red-500/80 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-white/[0.07]" />

      {/* Atmospheric effects & Motion sliders */}
      <section aria-labelledby="atmosphere-heading" className="space-y-5">
        <h2
          id="atmosphere-heading"
          className="text-sm font-semibold text-zinc-100"
        >
          Atmosphère et mouvement
        </h2>

        <div>
          <label className="mb-2 block text-xs font-medium text-zinc-300">
            Effet visuel d’ambiance
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PARTICLE_OPTIONS.map((opt) => {
              const active = config.particleEffect === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateConfig({ particleEffect: opt.id })}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'border-[#D4A853] bg-[#D4A853]/15 text-[#F5E6C8]'
                      : 'border-white/[0.08] bg-[#141419] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label htmlFor="scrim-slider" className="font-medium text-zinc-300">
              Voile de contraste (lisibilité)
            </label>
            <span className="font-mono-tabular text-zinc-400">
              {Math.round(config.scrimOpacity * 100)}%
            </span>
          </div>
          <input
            id="scrim-slider"
            type="range"
            min={0}
            max={0.85}
            step={0.02}
            value={config.scrimOpacity}
            onChange={(e) =>
              onUpdateConfig({ scrimOpacity: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <label htmlFor="motion-slider" className="font-medium text-zinc-300">
              Mouvement caméra (zoom lent)
            </label>
            <span className="font-mono-tabular text-zinc-400">
              {Math.round(config.motionIntensity * 100)}%
            </span>
          </div>
          <input
            id="motion-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.motionIntensity}
            onChange={(e) =>
              onUpdateConfig({ motionIntensity: Number(e.target.value) })
            }
            className="studio-slider w-full"
          />
        </div>
      </section>
    </div>
  );
}
