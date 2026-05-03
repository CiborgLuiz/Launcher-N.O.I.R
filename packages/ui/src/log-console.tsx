import React from "react";
import { LauncherLogEntry, LogCategory } from "../../shared/src";

type LogConsoleProps = {
  entries: LauncherLogEntry[];
  category: LogCategory | "all";
};

type LooseLogEntry = Partial<LauncherLogEntry> & {
  ts?: string;
};

const MAX_VISIBLE_LOGS = 300;

function normalizeLogEntry(entry: LooseLogEntry, index: number): LauncherLogEntry {
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : typeof entry.ts === "string" ? entry.ts : new Date(0).toISOString();
  const category = entry.category === "auth" || entry.category === "install" || entry.category === "minecraft" || entry.category === "launcher"
    ? entry.category
    : "launcher";
  const level = entry.level === "warn" || entry.level === "error" || entry.level === "info" ? entry.level : "info";
  const message = typeof entry.message === "string" ? entry.message : `Log sem mensagem #${index + 1}`;

  return {
    timestamp,
    category,
    level,
    message,
    context: entry.context && typeof entry.context === "object" ? entry.context : undefined
  };
}

function formatLogTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "--:--:--" : date.toLocaleTimeString();
}

export function LogConsole({ entries, category }: LogConsoleProps) {
  const normalizedEntries = entries.map(normalizeLogEntry);
  const filtered = category === "all" ? normalizedEntries : normalizedEntries.filter((entry) => entry.category === category);
  const visibleEntries = filtered.slice(-MAX_VISIBLE_LOGS).reverse();
  const hiddenCount = Math.max(0, filtered.length - visibleEntries.length);

  return (
    <div className="rounded-lg border border-[#C9A24E]/12 bg-[#080808] p-4">
      <div className="grid grid-cols-[120px,100px,1fr] gap-3 border-b border-[#C9A24E]/10 pb-3 text-[10px] uppercase tracking-[0.18em] text-[#B89A55]">
        <span>Timestamp</span>
        <span>Canal</span>
        <span>Mensagem</span>
      </div>
      <div className="mt-3 max-h-[340px] space-y-3 overflow-auto pr-2 text-sm">
        {hiddenCount > 0 && (
          <div className="rounded-lg border border-[#C9A24E]/10 bg-[#111111] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#B89A55]">
            Mostrando os ultimos {MAX_VISIBLE_LOGS} de {filtered.length} eventos.
          </div>
        )}
        {visibleEntries.length === 0 && <div className="rounded-lg bg-[#111111] px-4 py-5 text-[#B89A55]">Nenhum log nesta categoria.</div>}
        {visibleEntries.map((entry, index) => (
          <div key={`${entry.timestamp}-${index}`} className="grid grid-cols-[120px,100px,1fr] gap-3 rounded-lg bg-[#111111] px-3 py-3">
            <span className="text-xs text-[#B89A55]">{formatLogTime(entry.timestamp)}</span>
            <span className="text-xs uppercase tracking-[0.16em] text-[#C9A24E]">{entry.category}</span>
            <div>
              <div className="break-words text-[#F7E8C3]">{entry.message}</div>
              {entry.context && (
                <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-[#050505] p-3 text-[11px] text-[#B89A55]">
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
