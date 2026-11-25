import { Download } from 'lucide-react';
import { WorkspaceModule } from '../types/studio';

interface TopBarProps {
  activeModule: WorkspaceModule;
  onSelectModule: (module: WorkspaceModule) => void;
  onOpenExport: () => void;
}

const MODULE_LINKS: { id: WorkspaceModule; label: string }[] = [
  { id: 'studio', label: 'Studio' },
  { id: 'library', label: 'Bibliothèque' },
  { id: 'automation', label: 'Automatisation' },
];

export function TopBar({
  activeModule,
  onSelectModule,
  onOpenExport,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#09090B]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:gap-8 sm:px-6">
        {/* Zone 1: Single-line wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            onSelectModule('studio');
          }}
          className="font-display text-lg font-semibold tracking-tight text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4A853]"
        >
          NoorReel
        </a>

        {/* Zone 2: 3 core engine links */}
        <nav
          aria-label="Modules de la plateforme"
          role="tablist"
          className="flex items-center gap-4 sm:gap-7"
        >
          {MODULE_LINKS.map((mod) => {
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectModule(mod.id)}
                className={`relative py-4 text-xs sm:text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A853] ${
                  isActive
                    ? 'text-zinc-50'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mod.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-[#D4A853]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenExport}
            className="inline-flex items-center gap-2 rounded-lg bg-[#D4A853] px-3.5 sm:px-4 py-2 text-xs font-semibold text-[#09090B] transition-colors duration-150 hover:bg-[#e2ba6a] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4A853]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Exporter la vidéo</span>
            <span className="sm:hidden">Exporter</span>
          </button>
        </div>
      </div>
    </header>
  );
}
