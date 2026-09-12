'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Film,
  Image as ImageIcon,
  Check,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Globe,
  HardDrive,
  Play,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

export interface ReplaceImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (filename: string) => void;
  allImages: string[];
  currentImage?: string;
  sceneIndex?: number | null;
  sceneKeyword?: string;
}

type MediaTypeFilter = 'all' | 'videos' | 'images';
type SourceFilter = 'all' | 'pexels' | 'pixabay' | 'unsplash' | 'local';

export function parseMediaMetadata(filename: string) {
  const isVideo = /\.(mp4|webm|mov)$/i.test(filename);
  const lastDot = filename.lastIndexOf('.');
  const ext = lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  const nameWithoutExt = lastDot !== -1 ? filename.slice(0, lastDot) : filename;

  let source: 'Pexels' | 'Pixabay' | 'Unsplash' | 'Local' = 'Local';
  let sourceKey: SourceFilter = 'local';
  let cleanName = nameWithoutExt;

  if (/^pexels[_-]/i.test(cleanName)) {
    source = 'Pexels';
    sourceKey = 'pexels';
    cleanName = cleanName.replace(/^pexels[_-]\d*[_-]?/i, '');
  } else if (/^pixabay[_-]/i.test(cleanName)) {
    source = 'Pixabay';
    sourceKey = 'pixabay';
    cleanName = cleanName.replace(/^pixabay[_-]\d*[_-]?/i, '');
  } else if (/^unsplash[_-]/i.test(cleanName)) {
    source = 'Unsplash';
    sourceKey = 'unsplash';
    cleanName = cleanName.replace(/^unsplash[_-][A-Za-z0-9_-]+[_-]/i, '');
  }

  const formattedTitle =
    cleanName
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || nameWithoutExt;

  return { isVideo, source, sourceKey, formattedTitle, ext };
}

export default function ReplaceImageModal({
  isOpen,
  onClose,
  onSelectImage,
  allImages,
  currentImage,
  sceneIndex,
  sceneKeyword,
}: ReplaceImageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Pre-fill search with scene keyword or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setMediaTypeFilter('all');
      setSourceFilter('all');
      setHoveredVideo(null);

      // Accessibility: focus search input on open
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Parsed metadata cache for performance
  const parsedList = useMemo(() => {
    return allImages.map((img) => ({
      filename: img,
      ...parseMediaMetadata(img),
    }));
  }, [allImages]);

  // Count summaries for filter pills
  const counts = useMemo(() => {
    const videoCount = parsedList.filter((item) => item.isVideo).length;
    const imageCount = parsedList.length - videoCount;
    const pexelsCount = parsedList.filter((item) => item.sourceKey === 'pexels').length;
    const pixabayCount = parsedList.filter((item) => item.sourceKey === 'pixabay').length;
    const unsplashCount = parsedList.filter((item) => item.sourceKey === 'unsplash').length;
    const localCount = parsedList.filter((item) => item.sourceKey === 'local').length;

    return {
      total: parsedList.length,
      videos: videoCount,
      images: imageCount,
      pexels: pexelsCount,
      pixabay: pixabayCount,
      unsplash: unsplashCount,
      local: localCount,
    };
  }, [parsedList]);

  // Filtered images list based on search and filters
  const filteredList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return parsedList.filter((item) => {
      // 1. Media type filter
      if (mediaTypeFilter === 'videos' && !item.isVideo) return false;
      if (mediaTypeFilter === 'images' && item.isVideo) return false;

      // 2. Source filter
      if (sourceFilter !== 'all' && item.sourceKey !== sourceFilter) return false;

      // 3. Search query
      if (query) {
        const matchesFilename = item.filename.toLowerCase().includes(query);
        const matchesTitle = item.formattedTitle.toLowerCase().includes(query);
        const matchesSource = item.source.toLowerCase().includes(query);
        if (!matchesFilename && !matchesTitle && !matchesSource) {
          return false;
        }
      }

      return true;
    });
  }, [parsedList, searchQuery, mediaTypeFilter, sourceFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="replace-modal-title"
      aria-describedby="replace-modal-desc"
    >
      {/* Backdrop overlay (50% scrim from DESIGN.md) */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Modal Container */}
      <div
        ref={modalContainerRef}
        className="relative w-full max-w-5xl h-[94vh] sm:h-[88vh] flex flex-col rounded-2xl border border-hairline bg-white shadow-airbnb overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 my-auto"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-hairline-soft bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-full bg-[#fff0f2] text-rausch shrink-0">
              <Layers className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="replace-modal-title" className="text-base sm:text-lg font-bold text-ink tracking-tight">
                  Select Replacement Asset
                </h2>
                {typeof sceneIndex === 'number' && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[#fff0f2] text-rausch border border-[#ffd1da]">
                    Scene {sceneIndex + 1}
                  </span>
                )}
                {sceneKeyword && (
                  <span className="text-xs text-muted hidden md:inline truncate">
                    &ldquo;{sceneKeyword}&rdquo;
                  </span>
                )}
              </div>
              <p id="replace-modal-desc" className="text-xs text-muted mt-0.5 truncate">
                Choose a photo or stock video clip from your library to override this scene.
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-hairline text-ink hover:bg-surface-soft transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink shrink-0"
            aria-label="Close replacement dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 sm:p-4 bg-surface-soft/60 border-b border-hairline-soft flex flex-col gap-3 shrink-0">
          {/* Search Input Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-grow flex items-center">
              <label htmlFor="media-library-search" className="sr-only">
                Search media library
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                <Search className="w-4 h-4" aria-hidden="true" />
              </div>
              <input
                ref={searchInputRef}
                id="media-library-search"
                name="mediaSearch"
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search by keyword, filename, or source…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-hairline text-ink placeholder-muted text-sm outline-none transition-all focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-ink/10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-ink transition-colors focus-visible:outline-none"
                  aria-label="Clear search input"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Quick button to search scene keyword if available */}
            {sceneKeyword && searchQuery !== sceneKeyword && (
              <button
                type="button"
                onClick={() => setSearchQuery(sceneKeyword)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-surface-soft text-ink border border-hairline text-xs font-semibold transition-colors shrink-0 shadow-sm"
                title={`Search for "${sceneKeyword}"`}
              >
                <Sparkles className="w-3.5 h-3.5 text-rausch" aria-hidden="true" />
                <span>Search &ldquo;{sceneKeyword}&rdquo;</span>
              </button>
            )}
          </div>

          {/* Quick Filter Pills Row (Mobile Scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 text-xs">
            {/* Media Type Tabs */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-hairline shrink-0 shadow-sm">
              <button
                type="button"
                onClick={() => setMediaTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  mediaTypeFilter === 'all'
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setMediaTypeFilter('videos')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  mediaTypeFilter === 'videos'
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <Film className="w-3 h-3" aria-hidden="true" />
                Videos ({counts.videos})
              </button>
              <button
                type="button"
                onClick={() => setMediaTypeFilter('images')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  mediaTypeFilter === 'images'
                    ? 'bg-ink text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <ImageIcon className="w-3 h-3" aria-hidden="true" />
                Photos ({counts.images})
              </button>
            </div>

            <div className="h-4 w-px bg-hairline shrink-0" aria-hidden="true" />

            {/* Source Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { key: 'all', label: 'All Sources' },
                  { key: 'pexels', label: `Pexels (${counts.pexels})` },
                  { key: 'pixabay', label: `Pixabay (${counts.pixabay})` },
                  { key: 'unsplash', label: `Unsplash (${counts.unsplash})` },
                  { key: 'local', label: `Local (${counts.local})` },
                ] as const
              ).map((src) => {
                const isActive = sourceFilter === src.key;
                return (
                  <button
                    key={src.key}
                    type="button"
                    onClick={() => setSourceFilter(src.key)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold border transition-all text-xs ${
                      isActive
                        ? 'bg-[#fff0f2] text-rausch border-[#ffd1da]'
                        : 'bg-white text-muted border-hairline hover:text-ink hover:border-border-strong shadow-sm'
                    }`}
                  >
                    {src.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Gallery Grid (Scrollable with Responsive Layout) */}
        <div className="flex-grow overflow-y-auto p-3 sm:p-5 bg-white">
          {filteredList.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
              {filteredList.map((item) => {
                const isSelectedCurrent = currentImage === item.filename;
                const isHovered = hoveredVideo === item.filename;

                return (
                  <button
                    key={item.filename}
                    type="button"
                    onClick={() => onSelectImage(item.filename)}
                    onMouseEnter={() => item.isVideo && setHoveredVideo(item.filename)}
                    onMouseLeave={() => item.isVideo && setHoveredVideo(null)}
                    onFocus={() => item.isVideo && setHoveredVideo(item.filename)}
                    onBlur={() => item.isVideo && setHoveredVideo(null)}
                    className={`relative flex flex-col rounded-xl overflow-hidden border text-left transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink ${
                      isSelectedCurrent
                        ? 'border-rausch ring-2 ring-rausch/40 shadow-airbnb bg-[#fff8f9]'
                        : 'border-hairline bg-white hover:border-border-strong hover:shadow-airbnb hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Media Thumbnail Container with 3:4 Aspect Ratio */}
                    <div className="relative w-full aspect-[3/4] bg-surface-soft overflow-hidden flex items-center justify-center">
                      {item.isVideo ? (
                        <>
                          <video
                            src={`/api/images/${encodeURIComponent(item.filename)}`}
                            muted
                            loop
                            playsInline
                            autoPlay={isHovered}
                            preload="metadata"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 motion-reduce:transform-none"
                            ref={(el) => {
                              if (el) {
                                if (isHovered) {
                                  el.play().catch(() => {});
                                } else {
                                  el.pause();
                                  el.currentTime = 0;
                                }
                              }
                            }}
                          />
                          {/* Video Indicator Pill */}
                          <div className="absolute top-2 left-2 z-10">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-rausch text-white shadow-sm backdrop-blur-sm flex items-center gap-1">
                              <Film className="w-2.5 h-2.5" aria-hidden="true" />
                              Video
                            </span>
                          </div>
                          {!isHovered && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10 group-hover:bg-transparent transition-colors">
                              <div className="w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-lg">
                                <Play className="w-3.5 h-3.5 ml-0.5 fill-white" aria-hidden="true" />
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/images/${encodeURIComponent(item.filename)}`}
                          alt={item.formattedTitle || item.filename}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 motion-reduce:transform-none"
                          onError={(e) => {
                            (e.target as HTMLElement).style.opacity = '0.3';
                          }}
                        />
                      )}

                      {/* Top Right Source Badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-white/90 text-ink border border-hairline-soft backdrop-blur-sm shadow-sm">
                          {item.source}
                        </span>
                      </div>

                      {/* Current Active Indicator */}
                      {isSelectedCurrent && (
                        <div className="absolute inset-0 bg-rausch/10 border-2 border-rausch flex items-center justify-center pointer-events-none">
                          <div className="px-2.5 py-1 rounded-full bg-rausch text-white text-xs font-bold shadow-lg flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Current
                          </div>
                        </div>
                      )}

                      {/* Bottom Gradient Scrim with Title & Extension */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 pt-6 flex flex-col justify-end">
                        <span className="text-xs font-bold text-white truncate block">
                          {item.formattedTitle}
                        </span>
                        <div className="flex items-center justify-between text-[10px] text-zinc-300 mt-0.5">
                          <span className="truncate max-w-[80%] font-mono text-[9px]">
                            {item.filename}
                          </span>
                          <span className="uppercase text-[9px] text-zinc-400 font-semibold shrink-0">
                            {item.ext.replace('.', '')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="py-16 text-center flex flex-col items-center justify-center max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-surface-soft border border-hairline flex items-center justify-center text-muted mb-4 shadow-sm">
                <Search className="w-6 h-6 text-muted" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-ink">No matching assets found</h3>
              <p className="text-xs text-muted mt-1">
                {searchQuery
                  ? `No media matched “${searchQuery}”. Try a different search query or clear your filters.`
                  : 'No assets available for the selected filters.'}
              </p>
              {(searchQuery || mediaTypeFilter !== 'all' || sourceFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setMediaTypeFilter('all');
                    setSourceFilter('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-rausch hover:bg-rausch-active text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="p-3.5 sm:p-4 border-t border-hairline-soft bg-white flex items-center justify-between gap-3 text-xs text-muted shrink-0">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="text-ink font-bold tabular-nums">
                {filteredList.length}
              </strong>{' '}
              of{' '}
              <span className="tabular-nums">{parsedList.length}</span> assets
            </span>
            <span className="text-hairline hidden sm:inline">•</span>
            <span className="hidden sm:inline text-muted">
              Hover or focus videos to play • Click to select
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-hairline bg-white text-xs font-bold text-ink hover:bg-surface-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
