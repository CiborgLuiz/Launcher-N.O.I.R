import React from "react";

type PanelProps = React.PropsWithChildren<{
  className?: string;
  title?: string;
  subtitle?: string;
}>;

export function Panel({ children, className = "", title, subtitle }: PanelProps) {
  return (
    <section className={`animate-panel-in rounded-lg border border-[#C9A24E]/16 bg-[linear-gradient(180deg,rgba(14,14,14,0.94),rgba(5,5,5,0.92))] p-6 shadow-card backdrop-blur-xl ${className}`}>
      {(title || subtitle) && (
        <header className="mb-5">
          {title && <h2 className="font-display text-lg uppercase tracking-[0.22em] text-[#F7E8C3]">{title}</h2>}
          {subtitle && <p className="mt-2 max-w-xl text-sm text-[#CBB26B]/70">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
