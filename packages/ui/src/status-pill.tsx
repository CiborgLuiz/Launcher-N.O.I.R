import React from "react";

type StatusPillProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export function StatusPill({ label, value, tone = "default" }: StatusPillProps) {
  const tones = {
    default: "border-[#C7A24A]/12 bg-[#1B1711] text-[#F6F0E1]",
    success: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
    warning: "border-[#C7A24A]/24 bg-[#C7A24A]/10 text-[#F0DEAE]",
    danger: "border-rose-300/22 bg-rose-300/8 text-rose-100"
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.24em] text-[#B49A66]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#F6F0E1]">{value}</div>
    </div>
  );
}
