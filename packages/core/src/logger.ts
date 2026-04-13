import fs from "fs-extra";
import path from "node:path";
import { getLauncherPaths, LauncherPaths } from "../../instance-manager/src";
import { LogCategory, LogLevel, LauncherLogEntry, parseLogEntry, serializeLogEntry } from "../../shared/src";

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

      const content = await fs.readFile(filePath, "utf8");
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

    return entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }
}
