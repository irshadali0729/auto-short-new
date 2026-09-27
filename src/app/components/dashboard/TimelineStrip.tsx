"use client";

import React from "react";
import type { Scene } from "@/app/types/scene";
import SceneMedia from "./SceneMedia";

// Scene thumbnails sized by duration, so pacing is visible at a glance.
export default function TimelineStrip({
  scenes,
  activeIndex,
  onSelect,
}: {
  scenes: Scene[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  const total = scenes.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div>
      <div className="flex gap-1 h-14 overflow-x-auto no-scrollbar" role="group" aria-label="Scene timeline">
        {scenes.map((scene, i) => (
          <button
            key={scene.id ?? i}
            type="button"
            onClick={() => onSelect(i)}
            title={`Scene ${i + 1} · ${scene.duration.toFixed(1)}s`}
            aria-label={`Scene ${i + 1}, ${scene.duration.toFixed(1)} seconds`}
            aria-current={i === activeIndex ? "true" : undefined}
            style={{ flexGrow: scene.duration, flexBasis: 0 }}
            className={`relative min-w-[36px] rounded-md overflow-hidden bg-surface-strong transition-all ${
              i === activeIndex ? "ring-2 ring-rausch ring-offset-1 ring-offset-canvas" : "opacity-80 hover:opacity-100"
            }`}
          >
            <SceneMedia src={scene.image} alt="" autoPlay={false} className="absolute inset-0 w-full h-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 px-1 py-0.5 bg-gradient-to-t from-black/70 to-transparent text-[10px] font-bold text-white text-left tabular-nums">
              {i + 1} · {scene.duration.toFixed(0)}s
            </span>
            {scene.duaInfo?.isDua && <span className="absolute top-0.5 right-0.5 text-[10px]">🤲</span>}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-muted tabular-nums">
        <span>0s</span>
        <span>{(total / 2).toFixed(0)}s</span>
        <span>{total.toFixed(0)}s</span>
      </div>
    </div>
  );
}
