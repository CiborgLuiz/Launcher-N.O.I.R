import React from "react";

type StatusPillProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export function StatusPill({ label, value, tone = "default" }: StatusPillProps) {
  const tones = {
    default: "border-[#C9A24E]/14 bg-[#111111] text-[#F7E8C3]",
    success: "border-emerald-300/20 bg-emerald-300/8 text-emerald-100",
    warning: "border-[#C9A24E]/24 bg-[#C9A24E]/10 text-[#F0DEAE]",
    danger: "border-rose-300/22 bg-rose-300/8 text-rose-100"
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#B89A55]">{label}</div>
      <div className="mt-2 text-sm font-semibold text-[#F7E8C3]">{value}</div>
    </div>
  );
}
