import React from "react";

type ProgressRailProps = {
  progress: number;
  label: string;
};

export function ProgressRail({ progress, label }: ProgressRailProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#B89A55]">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#1A160C]">
        <div
          className="noir-progress-fill h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(6, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
