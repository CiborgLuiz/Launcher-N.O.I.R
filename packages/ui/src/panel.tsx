import React from "react";

type PanelProps = React.PropsWithChildren<{
  className?: string;
  title?: string;
  subtitle?: string;
}>;

export function Panel({ children, className = "", title, subtitle }: PanelProps) {
  return (
    <section className={`rounded-[28px] border border-[#C7A24A]/14 bg-[rgba(20,17,12,0.9)] p-6 shadow-card backdrop-blur-xl ${className}`}>
      {(title || subtitle) && (
        <header className="mb-5">
          {title && <h2 className="font-display text-lg uppercase tracking-[0.3em] text-[#F6F0E1]">{title}</h2>}
          {subtitle && <p className="mt-2 max-w-xl text-sm text-[#C7B182]/70">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
