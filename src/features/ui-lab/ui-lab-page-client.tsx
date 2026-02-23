'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { FaRegMoon } from 'react-icons/fa';
import { LuSunMedium } from 'react-icons/lu';
import { uiLabCategoryLabel, uiLabCategoryOrder, uiLabRegistry } from '@/features/ui-lab/registry';
import type { UiLabCanvasBackground, UiLabCanvasState, UiLabDataMode, UiLabEntry } from '@/features/ui-lab/types';

type UiLabPageClientProps = {
  initialSlug: string[];
};

type UiLabCategory = (typeof uiLabCategoryOrder)[number];

const DEFAULT_CANVAS: UiLabCanvasState = {
  pad: 24,
  maxW: 960,
  bg: 'background',
};

const SIDEBAR_EXPANDED_WIDTH = 292;
const SIDEBAR_MINIMIZED_WIDTH = 80;

const MIN_PAD = 0;
const MAX_PAD = 64;
const MIN_MAX_W = 360;
const MAX_MAX_W = 1440;

const createCollapsedSections = (activeCategory?: UiLabCategory): Record<UiLabCategory, boolean> => {
  return Object.fromEntries(
    uiLabCategoryOrder.map((category) => [category, activeCategory ? category !== activeCategory : false]),
  ) as Record<UiLabCategory, boolean>;
};

const canvasBackgroundClasses: Record<UiLabCanvasBackground, string> = {
  background: 'bg-background',
  surface: 'bg-surface',
  hovered: 'bg-hovered',
};

const categoryCompactLabel: Record<UiLabCategory, string> = {
  'ui-primitives': 'UI',
  filters: 'FS',
  identity: 'ID',
  'data-display': 'DD',
  controls: 'CT',
  modals: 'MD',
};

const dataModeLabel: Record<UiLabDataMode, string> = {
  fixture: 'Fixture data',
  hybrid: 'Hybrid data',
  live: 'Live data',
};

const dataModeClasses: Record<UiLabDataMode, string> = {
  fixture: 'border-green-500/30 bg-green-500/10 text-green-500',
  hybrid: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  live: 'border-red-500/30 bg-red-500/10 text-red-500',
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const parseNumericParam = (value: string | null, fallback: number, min: number, max: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const resolveCanvasState = (entry: UiLabEntry, searchParams: ReadonlyURLSearchParams): UiLabCanvasState => {
  const entryDefaults = {
    ...DEFAULT_CANVAS,
    ...entry.defaultCanvas,
  };

  const backgroundParam = searchParams.get('bg');
  const bg =
    backgroundParam === 'background' || backgroundParam === 'surface' || backgroundParam === 'hovered' ? backgroundParam : entryDefaults.bg;

  return {
    pad: parseNumericParam(searchParams.get('pad'), entryDefaults.pad, MIN_PAD, MAX_PAD),
    maxW: parseNumericParam(searchParams.get('maxW'), entryDefaults.maxW, MIN_MAX_W, MAX_MAX_W),
    bg,
  };
};

export function UiLabPageClient({ initialSlug }: UiLabPageClientProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isThemeMounted, setIsThemeMounted] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<UiLabCategory, boolean>>(createCollapsedSections());

  const requestedId = initialSlug[0];

  const requestedEntry = useMemo(() => {
    if (!requestedId) return null;
    return uiLabRegistry.find((entry) => entry.id === requestedId) ?? null;
  }, [requestedId]);

  const selectedEntry = requestedEntry ?? uiLabRegistry[0];

  const canvas = useMemo(() => {
    if (!selectedEntry) {
      return DEFAULT_CANVAS;
    }

    return resolveCanvasState(selectedEntry, searchParams);
  }, [selectedEntry, searchParams]);

  const groupedEntries = useMemo(() => {
    const groupMap = new Map<UiLabCategory, UiLabEntry[]>();

    for (const category of uiLabCategoryOrder) {
      groupMap.set(category, []);
    }

    for (const entry of uiLabRegistry) {
      const group = groupMap.get(entry.category);
      if (group) {
        group.push(entry);
      }
    }

    return groupMap;
  }, []);

  const searchParamsString = searchParams.toString();

  useEffect(() => {
    if (!selectedEntry) return;
    if (requestedId === selectedEntry.id) return;

    const nextPath = `/ui-lab/${selectedEntry.id}`;
    const nextUrl = searchParamsString ? `${nextPath}?${searchParamsString}` : nextPath;
    router.replace(nextUrl, { scroll: false });
  }, [requestedId, router, searchParamsString, selectedEntry]);

  useEffect(() => {
    if (!selectedEntry) {
      setCollapsedSections(createCollapsedSections());
      return;
    }

    setCollapsedSections(createCollapsedSections(selectedEntry.category));
  }, [selectedEntry?.category]);

  useEffect(() => {
    setIsThemeMounted(true);
  }, []);

  const navigateToEntry = (entryId: string) => {
    const nextPath = `/ui-lab/${entryId}`;
    const nextUrl = searchParamsString ? `${nextPath}?${searchParamsString}` : nextPath;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const replaceSearchParams = (patch: Record<string, string>) => {
    const nextSearchParams = new URLSearchParams(searchParamsString);

    for (const [key, value] of Object.entries(patch)) {
      nextSearchParams.set(key, value);
    }

    const nextQuery = nextSearchParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;

    startTransition(() => {
      router.replace(nextUrl, { scroll: false });
    });
  };

  const toggleSection = (category: UiLabCategory) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const openCategory = (category: UiLabCategory) => {
    const firstEntry = groupedEntries.get(category)?.[0];
    if (!firstEntry) return;

    setCollapsedSections(createCollapsedSections(category));
    setIsSidebarMinimized(false);
    navigateToEntry(firstEntry.id);
  };

  if (!selectedEntry) {
    return <div className="p-8 font-zen text-primary">UI Lab registry is empty.</div>;
  }

  const canvasBgClass = canvasBackgroundClasses[canvas.bg];
  const isDarkTheme = theme === 'dark';
  const selectedDataMode = selectedEntry.dataMode ?? 'fixture';

  return (
    <div className="flex min-h-screen bg-background text-primary font-zen">
      <motion.aside
        animate={{ width: isSidebarMinimized ? SIDEBAR_MINIMIZED_WIDTH : SIDEBAR_EXPANDED_WIDTH }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="shrink-0 overflow-hidden border-r border-border bg-surface/40"
      >
        <div className="h-full p-3">
          <div className={`flex items-center ${isSidebarMinimized ? 'justify-center' : 'justify-between'}`}>
            {isSidebarMinimized ? null : (
              <div>
                <h1 className="text-base">UI Lab</h1>
                <p className="text-[11px] text-secondary">Component sections</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarMinimized((prev) => !prev)}
              className="rounded-sm border border-border bg-background px-2 py-1 text-xs text-secondary hover:text-primary"
              aria-label={isSidebarMinimized ? 'Expand sidebar' : 'Minimize sidebar'}
            >
              {isSidebarMinimized ? '>' : '<'}
            </button>
          </div>

          {isSidebarMinimized ? (
            <div className="mt-4 flex flex-col gap-2">
              {uiLabCategoryOrder.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => openCategory(category)}
                  className={`rounded-sm border px-2 py-2 text-xs transition ${
                    selectedEntry.category === category
                      ? 'border-primary bg-hovered text-primary'
                      : 'border-border bg-background text-secondary hover:text-primary'
                  }`}
                  title={uiLabCategoryLabel[category]}
                >
                  {categoryCompactLabel[category]}
                </button>
              ))}
            </div>
          ) : (
            <nav className="mt-4 space-y-3">
              {uiLabCategoryOrder.map((category) => {
                const entries = groupedEntries.get(category) ?? [];
                if (entries.length === 0) return null;

                const isCollapsed = collapsedSections[category];

                return (
                  <section
                    key={category}
                    className="rounded-sm border border-border/70 bg-background/60 p-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(category)}
                      className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-hovered/60"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-wide text-secondary">{uiLabCategoryLabel[category]}</p>
                        <p className="text-[11px] text-secondary/80">{entries.length} items</p>
                      </div>
                      <span className="text-xs text-secondary">{isCollapsed ? '+' : '-'}</span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isCollapsed ? null : (
                        <motion.div
                          key={`${category}-list`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 space-y-1 pb-1">
                            {entries.map((entry) => {
                              const isSelected = entry.id === selectedEntry.id;

                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => navigateToEntry(entry.id)}
                                  className={`w-full rounded-sm px-2 py-2 text-left text-sm transition ${
                                    isSelected ? 'bg-hovered text-primary' : 'text-secondary hover:bg-hovered/60 hover:text-primary'
                                  }`}
                                >
                                  {entry.title}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </section>
                );
              })}
            </nav>
          )}
        </div>
      </motion.aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-lg">{selectedEntry.title}</h2>
          <p className="mt-1 text-sm text-secondary">{selectedEntry.description}</p>
          <span className={`mt-2 inline-flex rounded-sm border px-2 py-0.5 text-xs ${dataModeClasses[selectedDataMode]}`}>
            {dataModeLabel[selectedDataMode]}
          </span>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="min-w-0 flex-1 overflow-auto p-6">
            <div
              className={`rounded-sm border border-border ${canvasBgClass}`}
              style={{ padding: canvas.pad }}
            >
              <div
                className="mx-auto w-full"
                style={{ maxWidth: canvas.maxW }}
              >
                {selectedEntry.render()}
              </div>
            </div>
          </section>

          <aside className="w-[260px] shrink-0 border-l border-border bg-surface/40 p-4">
            <h3 className="text-sm font-medium">Canvas Controls</h3>

            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-sm border border-border bg-background p-2">
                <button
                  type="button"
                  onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
                  disabled={!isThemeMounted}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-hovered disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Toggle theme"
                >
                  <span className="text-xs text-secondary">Theme</span>
                  <span className="inline-flex items-center gap-2 text-xs">
                    {isDarkTheme ? (
                      <>
                        <FaRegMoon className="h-3.5 w-3.5" />
                        Dark
                      </>
                    ) : (
                      <>
                        <LuSunMedium className="h-3.5 w-3.5" />
                        Light
                      </>
                    )}
                  </span>
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-secondary">Padding: {canvas.pad}px</span>
                <input
                  type="range"
                  min={MIN_PAD}
                  max={MAX_PAD}
                  value={canvas.pad}
                  onChange={(event) =>
                    replaceSearchParams({
                      pad: String(clamp(Number(event.target.value), MIN_PAD, MAX_PAD)),
                    })
                  }
                  className="w-full"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-secondary">Max Width: {canvas.maxW}px</span>
                <input
                  type="range"
                  min={MIN_MAX_W}
                  max={MAX_MAX_W}
                  step={10}
                  value={canvas.maxW}
                  onChange={(event) =>
                    replaceSearchParams({
                      maxW: String(clamp(Number(event.target.value), MIN_MAX_W, MAX_MAX_W)),
                    })
                  }
                  className="w-full"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-secondary">Background</span>
                <select
                  value={canvas.bg}
                  onChange={(event) =>
                    replaceSearchParams({
                      bg: event.target.value,
                    })
                  }
                  className="h-9 w-full rounded-sm border border-border bg-background px-2"
                >
                  <option value="background">Background</option>
                  <option value="surface">Surface</option>
                  <option value="hovered">Hovered</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() => {
                  const defaults = {
                    ...DEFAULT_CANVAS,
                    ...selectedEntry.defaultCanvas,
                  };
                  replaceSearchParams({
                    pad: String(defaults.pad),
                    maxW: String(defaults.maxW),
                    bg: defaults.bg,
                  });
                }}
                className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm hover:bg-hovered"
              >
                Reset to Default
              </button>

              {isPending ? <p className="text-xs text-secondary">Updating...</p> : null}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
