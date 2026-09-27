"use client";

import React, { useState } from "react";
import type { Scene } from "@/app/types/scene";
import type { TextOverlayMode } from "@/app/components/SettingsModal";
import SceneCard, { type SceneCardHandlers } from "./SceneCard";
import TimelineStrip from "./TimelineStrip";

interface StoryboardProps {
  scenes: Scene[];
  sceneStartTimes: number[];
  activeIndex: number;
  textOverlayMode: TextOverlayMode;
  brokenIds: Set<string>;
  savingIds: Set<string>;
  regeneratingIds: Set<string>;
  onSelect: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  /** Per-scene handlers, bound by scene id. */
  handlersFor: (scene: Scene, index: number) => Omit<SceneCardHandlers, "onSelect" | "onMove">;
}

export default function Storyboard({
  scenes,
  sceneStartTimes,
  activeIndex,
  textOverlayMode,
  brokenIds,
  savingIds,
  regeneratingIds,
  onSelect,
  onReorder,
  handlersFor,
}: StoryboardProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const total = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <section id="step-scenes" className="airbnb-card p-5 sm:p-6 scroll-mt-28">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Scenes</h2>
          <p className="text-xs text-muted mt-0.5">
            {scenes.length} scenes · {total.toFixed(1)}s · edit text inline, drag to reorder
          </p>
        </div>
      </div>

      <div className="mb-5">
        <TimelineStrip scenes={scenes} activeIndex={activeIndex} onSelect={onSelect} />
      </div>

      {/* Mobile: one card per swipe. sm+: two-column grid. */}
      <div className="flex sm:grid sm:grid-cols-2 gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory no-scrollbar -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
        {scenes.map((scene, i) => {
          const id = scene.id ?? String(i);
          return (
            <div key={id} className="w-[85%] sm:w-auto shrink-0 snap-center flex">
              <div className="w-full">
                <SceneCard
                  scene={scene}
                  index={i}
                  total={scenes.length}
                  sceneStart={sceneStartTimes[i] ?? 0}
                  isActive={i === activeIndex}
                  isBroken={brokenIds.has(id)}
                  isSaving={savingIds.has(id)}
                  isRegenerating={regeneratingIds.has(id)}
                  textOverlayMode={textOverlayMode}
                  isDragOver={dragOver === i && dragFrom !== null && dragFrom !== i}
                  onDragStart={() => setDragFrom(i)}
                  onDragEnter={() => setDragOver(i)}
                  onDrop={() => {
                    if (dragFrom !== null && dragFrom !== i) onReorder(dragFrom, i);
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onDragEnd={() => {
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  onSelect={() => onSelect(i)}
                  onMove={(delta) => onReorder(i, i + delta)}
                  {...handlersFor(scene, i)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
