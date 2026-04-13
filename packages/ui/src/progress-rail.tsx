import React from "react";

type ProgressRailProps = {
  progress: number;
  label: string;
};

export function ProgressRail({ progress, label }: ProgressRailProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.25em] text-[#B49A66]">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#221C14]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(142,106,34,0.94),rgba(199,162,74,1),rgba(246,240,225,0.95))] transition-[width] duration-500"
          style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
