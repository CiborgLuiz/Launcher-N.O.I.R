import fs from "fs-extra";
import { open } from "node:fs/promises";
import path from "node:path";
import { getLauncherPaths, LauncherPaths } from "../../instance-manager/src";
import { LogCategory, LogLevel, LauncherLogEntry, parseLogEntry, serializeLogEntry } from "../../shared/src";

const MAX_LOG_ENTRIES = 800;
const MAX_LOG_FILE_BYTES = 512 * 1024;

function resolveLogFile(category: LogCategory, paths: LauncherPaths): string {
  switch (category) {
    case "auth":
      return paths.authLogPath;
    case "install":
      return paths.installLogPath;
    case "minecraft":
      return paths.minecraftLogPath;
    case "launcher":
    default:
      return paths.launcherLogPath;
  }
}

export class FileLogger {
  private readonly paths: LauncherPaths;

  constructor(paths = getLauncherPaths()) {
    this.paths = paths;
  }

  async log(category: LogCategory, level: LogLevel, message: string, context?: Record<string, unknown>): Promise<void> {
    const entry: LauncherLogEntry = {
      timestamp: new Date().toISOString(),
      category,
      level,
      message,
      context
    };
    const filePath = resolveLogFile(category, this.paths);
    await fs.ensureDir(path.dirname(filePath));
    await fs.appendFile(filePath, `${serializeLogEntry(entry)}\n`, "utf8");
  }

  async readLogs(category?: LogCategory): Promise<LauncherLogEntry[]> {
    const categories: LogCategory[] = category ? [category] : ["launcher", "auth", "install", "minecraft"];
    const entries: LauncherLogEntry[] = [];

    for (const currentCategory of categories) {
      const filePath = resolveLogFile(currentCategory, this.paths);
      if (!(await fs.pathExists(filePath))) {
        continue;
      }

      const stat = await fs.stat(filePath);
      const start = Math.max(0, stat.size - MAX_LOG_FILE_BYTES);
      const content = await readLogTail(filePath, start);
      for (const line of content.split(/\r?\n/)) {
        if (!line.trim()) {
          continue;
        }
        try {
          entries.push(parseLogEntry(line));
        } catch {
          entries.push({
            timestamp: new Date().toISOString(),
            category: currentCategory,
            level: "info",
            message: line
          });
        }
      }
    }

    return entries
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .slice(-MAX_LOG_ENTRIES);
  }
}

async function readLogTail(filePath: string, start: number): Promise<string> {
  const file = await open(filePath, "r");
  try {
    const stat = await file.stat();
    const length = stat.size - start;
    const buffer = Buffer.alloc(length);
    await file.read(buffer, 0, length, start);
    const text = buffer.toString("utf8");
    if (start === 0) {
      return text;
    }
    const firstNewline = text.indexOf("\n");
    return firstNewline >= 0 ? text.slice(firstNewline + 1) : text;
  } finally {
    await file.close();
  }
}
