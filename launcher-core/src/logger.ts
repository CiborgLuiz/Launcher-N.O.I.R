import fs from 'fs-extra';
import path from 'node:path';
import { logsRoot, ensureBaseDirs } from '../../config-system/src/paths';

export type LogLine = { ts: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string };

const launcherLogPath = path.join(logsRoot, 'launcher.log');
const minecraftLogPath = path.join(logsRoot, 'minecraft.log');

export async function log(line: LogLine) {
  await ensureBaseDirs();
  const formatted = `[${line.ts}] ${line.level} - ${line.message}\n`;
  await fs.appendFile(launcherLogPath, formatted, 'utf8');
}

export async function logMinecraft(line: LogLine) {
  await ensureBaseDirs();
  const formatted = `[${line.ts}] ${line.level} - ${line.message}\\n`;
  await fs.appendFile(minecraftLogPath, formatted, 'utf8');
}

export async function readLogs(): Promise<LogLine[]> {
  await ensureBaseDirs();
  const lines: LogLine[] = [];
  if (await fs.pathExists(launcherLogPath)) {
    const content = await fs.readFile(launcherLogPath, 'utf8');
    lines.push(
      ...content
        .split('\n')
        .filter(Boolean)
        .map((line: string) => parseLine(line, 'launcher'))
    );
  }
  if (await fs.pathExists(minecraftLogPath)) {
    const content = await fs.readFile(minecraftLogPath, 'utf8');
    lines.push(
      ...content
        .split('\n')
        .filter(Boolean)
        .map((line: string) => parseLine(line, 'minecraft'))
    );
  }
  return lines.sort((a, b) => a.ts.localeCompare(b.ts));
}

function parseLine(line: string, source: string): LogLine {
  const match = line.match(/^\\[(.+?)\\]\\s+(INFO|WARN|ERROR)\\s+-\\s+(.*)$/);
  if (!match) {
    return { ts: new Date().toISOString(), level: 'INFO', message: `[${source}] ${line}` };
  }
  return { ts: match[1], level: match[2] as LogLine['level'], message: `[${source}] ${match[3]}` };
}
