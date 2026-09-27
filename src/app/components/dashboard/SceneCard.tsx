"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Clock,
  Copy,
  Download,
  GripVertical,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Shuffle,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { Scene } from "@/app/types/scene";
import type { TextOverlayMode } from "@/app/components/SettingsModal";
import { isRemoteUrl, isVideoAsset } from "@/app/utils/media-url";
import SceneMedia from "./SceneMedia";

const QUICK_EMOJIS = ["💔", "🤲", "🔥", "⏳", "⚠️", "✨", "💰", "💡", "🥀", "😢", "🕌", "👑", "🕊️", "📖", "⚖️", "❤️"];

const TIER_LABEL: Record<string, string> = {
  visual: "Exact shot match",
  fallback: "Alternate shot match",
  mood: "Mood match",
  local: "Library match",
  random: "Random fallback",
  legacy: "Keyword match",
};

export interface SceneCardHandlers {
  onSelect: () => void;
  onReplace: () => void;
  onReplaceHost: () => void;
  onFindAnother: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
  onSaveLocally: () => void;
  onEditDua: () => void;
  onChangeEmoji: (emoji: string) => void;
  onEditCaption: (captionIndex: number, text: string) => void;
  onEditGraphic: (graphicIndex: number, heroWord: string) => void;
  onImageError: () => void;
  onImageLoad: () => void;
}

interface SceneCardProps extends SceneCardHandlers {
  scene: Scene;
  index: number;
  total: number;
  sceneStart: number;
  isActive: boolean;
  isBroken: boolean;
  isSaving: boolean;
  isRegenerating: boolean;
  textOverlayMode: TextOverlayMode;
  // Drag & drop (desktop); the ⋯ menu offers Move left/right everywhere.
  isDragOver: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export default function SceneCard(props: SceneCardProps) {
  const {
    scene,
    index,
    total,
    sceneStart,
    isActive,
    isBroken,
    isSaving,
    isRegenerating,
    textOverlayMode,
    isDragOver,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Only the grip arms dragging, so text inputs keep normal selection.
  const [dragArmed, setDragArmed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && !menuRef.current?.contains(target)) setMenuOpen(false);
      if (emojiOpen && !emojiRef.current?.contains(target)) setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen, emojiOpen]);

  const typeBadge = scene.isAvatarScene
    ? "Avatar hook"
    : scene.isSplitScreen
      ? "Split screen"
      : isVideoAsset(scene.image)
        ? "Video"
        : null;
  const canFindAnother = !scene.isAvatarScene;
  const menuItem =
    "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-ink hover:bg-surface-soft disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <article
      draggable={dragArmed}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        props.onDragStart();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        props.onDragEnter();
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        props.onDrop();
      }}
      onDragEnd={() => {
        setDragArmed(false);
        props.onDragEnd();
      }}
      onClick={props.onSelect}
      aria-label={`Scene ${index + 1}: ${scene.keyword}`}
      className={`relative rounded-2xl border bg-canvas overflow-visible flex flex-col transition-all cursor-pointer ${
        isActive ? "border-rausch ring-2 ring-rausch/30" : "border-hairline hover:shadow-airbnb"
      } ${isDragOver ? "outline-dashed outline-2 outline-offset-2 outline-rausch" : ""}`}
    >
      {/* Media */}
      <div className="relative h-40 bg-surface-soft rounded-t-2xl overflow-hidden">
        {scene.isSplitScreen && scene.avatarAsset ? (
          <div className="w-full h-full flex flex-col">
            <SceneMedia src={scene.avatarAsset} alt="Avatar" className="h-1/2 w-full object-cover object-[50%_25%]" />
            <SceneMedia
              src={scene.image}
              alt={scene.keyword}
              className="h-1/2 w-full object-cover"
              onError={props.onImageError}
              onLoad={props.onImageLoad}
            />
          </div>
        ) : (
          <SceneMedia
            src={scene.image}
            alt={scene.keyword}
            className="w-full h-full object-cover"
            onError={props.onImageError}
            onLoad={props.onImageLoad}
          />
        )}

        {isRegenerating && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {isBroken && !isRegenerating && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 text-center p-3">
            <AlertCircle className="w-6 h-6 text-white" />
            <p className="text-xs font-semibold text-white">Image failed to load</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onReplace();
              }}
              className="px-3 py-1.5 rounded-lg bg-white text-[#222] text-xs font-bold"
            >
              Replace image
            </button>
          </div>
        )}

        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
          <button
            type="button"
            onMouseDown={() => setDragArmed(true)}
            onMouseUp={() => setDragArmed(false)}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:flex w-7 h-7 rounded-full bg-black/55 text-white items-center justify-center cursor-grab active:cursor-grabbing"
            aria-label="Drag to reorder (or use the menu to move)"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-black/55 text-white backdrop-blur">
            {index + 1}
          </span>
          {typeBadge && (
            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-black/55 text-white backdrop-blur">
              {typeBadge}
            </span>
          )}
        </div>

        <span className="absolute bottom-2 right-2 z-10 px-2 py-1 rounded-full bg-black/60 text-white text-[11px] font-bold tabular-nums flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {scene.duration.toFixed(1)}s
        </span>
      </div>

      {/* Menu */}
      <div ref={menuRef} className="absolute top-2 right-2 z-30" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Scene ${index + 1} actions`}
          className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/75 text-white flex items-center justify-center"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 mt-1 w-44 py-1 rounded-xl border border-hairline bg-canvas shadow-airbnb-hover">
            <button role="menuitem" type="button" className={menuItem} onClick={() => { setMenuOpen(false); props.onDuplicate(); }}>
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button role="menuitem" type="button" className={menuItem} disabled={index === 0} onClick={() => { setMenuOpen(false); props.onMove(-1); }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Move earlier
            </button>
            <button role="menuitem" type="button" className={menuItem} disabled={index === total - 1} onClick={() => { setMenuOpen(false); props.onMove(1); }}>
              <ArrowRight className="w-3.5 h-3.5" /> Move later
            </button>
            {scene.isSplitScreen && scene.avatarAsset && (
              <button role="menuitem" type="button" className={menuItem} onClick={() => { setMenuOpen(false); props.onReplaceHost(); }}>
                <UserCheck className="w-3.5 h-3.5" /> Change host
              </button>
            )}
            <div className="my-1 border-t border-hairline-soft" />
            <button
              role="menuitem"
              type="button"
              className={`${menuItem} text-rausch`}
              disabled={total <= 1}
              onClick={() => { setMenuOpen(false); props.onDelete(); }}
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete scene
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-grow">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink truncate capitalize">{scene.keyword || "Untitled scene"}</h3>
          <div ref={emojiRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label="Change scene emoji"
              className="w-8 h-8 rounded-full border border-hairline bg-surface-soft hover:border-rausch text-base flex items-center justify-center"
            >
              {scene.emoji || "✨"}
            </button>
            {emojiOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 p-2 rounded-xl border border-hairline bg-canvas shadow-airbnb-hover w-48 grid grid-cols-4 gap-1">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      props.onChangeEmoji(em);
                      setEmojiOpen(false);
                    }}
                    className={`h-9 rounded-lg text-lg hover:bg-surface-soft ${scene.emoji === em ? "bg-[#fff0f2] ring-1 ring-rausch" : ""}`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Inline-editable on-screen text */}
        {textOverlayMode === "captions" && scene.captions && scene.captions.length > 0 && (
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            {scene.captions.map((c, cIdx) => (
              <label key={cIdx} className="flex items-center gap-2 group">
                <span className="text-[10px] text-muted tabular-nums w-9 shrink-0">+{c.start.toFixed(1)}s</span>
                <input
                  value={c.text}
                  onChange={(e) => props.onEditCaption(cIdx, e.target.value)}
                  onFocus={props.onSelect}
                  aria-label={`Caption ${cIdx + 1} of scene ${index + 1}`}
                  className="flex-1 min-w-0 px-2 py-1 rounded-md border border-transparent group-hover:border-hairline focus:border-ink bg-transparent focus:bg-canvas text-xs text-ink outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {textOverlayMode === "graphics" && scene.graphics && scene.graphics.length > 0 && (
          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
            {scene.graphics.map((g, gIdx) => (
              <label key={gIdx} className="flex items-center gap-2 group">
                <span className="text-[10px] text-muted tabular-nums w-9 shrink-0">+{g.start.toFixed(1)}s</span>
                {g.prefixText && <span className="text-[11px] text-muted truncate max-w-[30%]">{g.prefixText}</span>}
                <input
                  value={g.heroWord}
                  onChange={(e) => props.onEditGraphic(gIdx, e.target.value)}
                  onFocus={props.onSelect}
                  aria-label={`Animated word ${gIdx + 1} of scene ${index + 1}`}
                  className="flex-1 min-w-0 px-2 py-1 rounded-md border border-transparent group-hover:border-hairline focus:border-ink bg-transparent focus:bg-canvas text-xs font-bold uppercase text-rausch outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {scene.duaInfo?.isDua && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onEditDua();
            }}
            className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E2D3B3] bg-[#FAF6ED] text-[11px] font-bold text-[#8C682A]"
          >
            <BookOpen className="w-3 h-3" /> Dua card · Edit
          </button>
        )}

        {/* Secondary details, collapsed by default */}
        <div onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-ink"
          >
            Details
            <ChevronDown className={`w-3 h-3 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
          </button>
          {detailsOpen && (
            <div className="mt-2 space-y-1.5 text-[11px] text-muted">
              <p>
                <span className="font-semibold text-ink">Timing:</span> {sceneStart.toFixed(1)}s –{" "}
                {(sceneStart + scene.duration).toFixed(1)}s
              </p>
              {scene.matchedTier && (
                <p>
                  <span className="font-semibold text-ink">Match:</span>{" "}
                  {scene.isFallback ? "Fallback" : TIER_LABEL[scene.matchedTier] || scene.matchedTier}
                </p>
              )}
              {scene.visualQuery && (
                <p className="italic">
                  <span className="font-semibold text-ink not-italic">Shot:</span> “{scene.visualQuery}”
                </p>
              )}
              <p className="truncate" title={scene.image}>
                <span className="font-semibold text-ink">File:</span> {scene.image}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {isRemoteUrl(scene.image) && (
                  <button
                    type="button"
                    onClick={props.onSaveLocally}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-hairline hover:bg-surface-soft font-semibold text-ink disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {isSaving ? "Saving…" : "Save to My Library"}
                  </button>
                )}
                {!scene.duaInfo?.isDua && (
                  <button
                    type="button"
                    onClick={props.onEditDua}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-hairline hover:bg-surface-soft font-semibold text-ink"
                  >
                    <BookOpen className="w-3 h-3" /> Add Dua card
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Primary actions */}
        <div className="mt-auto grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={props.onReplace}
            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-hairline bg-canvas hover:bg-surface-soft text-xs font-bold text-ink"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={props.onFindAnother}
            disabled={!canFindAnother || isRegenerating}
            title={canFindAnother ? "Search stock sources for a different shot" : "Use Change host for avatar scenes"}
            className="inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border border-hairline bg-canvas hover:bg-surface-soft text-xs font-bold text-ink disabled:opacity-40"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Find another
          </button>
        </div>
      </div>
    </article>
  );
}
