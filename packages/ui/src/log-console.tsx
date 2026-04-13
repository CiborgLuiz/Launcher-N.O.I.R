import React from "react";
import { LauncherLogEntry, LogCategory } from "../../shared/src";

type LogConsoleProps = {
  entries: LauncherLogEntry[];
  category: LogCategory | "all";
};

export function LogConsole({ entries, category }: LogConsoleProps) {
  const filtered = category === "all" ? entries : entries.filter((entry) => entry.category === category);

  return (
    <div className="rounded-[24px] border border-[#C7A24A]/12 bg-[#100D09] p-4">
      <div className="grid grid-cols-[130px,100px,1fr] gap-3 border-b border-[#C7A24A]/10 pb-3 text-[10px] uppercase tracking-[0.22em] text-[#B49A66]">
        <span>Timestamp</span>
        <span>Canal</span>
        <span>Mensagem</span>
      </div>
      <div className="mt-3 max-h-[340px] space-y-3 overflow-auto pr-2 text-sm">
        {filtered.length === 0 && <div className="rounded-2xl bg-[#1A1610] px-4 py-5 text-[#B49A66]">Nenhum log nesta categoria.</div>}
        {filtered.map((entry, index) => (
          <div key={`${entry.timestamp}-${index}`} className="grid grid-cols-[130px,100px,1fr] gap-3 rounded-2xl bg-[#18130E] px-3 py-3">
            <span className="text-xs text-[#B49A66]">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            <span className="text-xs uppercase tracking-[0.2em] text-[#CBB071]">{entry.category}</span>
            <div>
              <div className="text-[#F6F0E1]">{entry.message}</div>
              {entry.context && (
                <pre className="mt-2 overflow-auto rounded-xl bg-[#0D0A06] p-3 text-[11px] text-[#B49A66]">
                  {JSON.stringify(entry.context, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
