import { autoUpdater } from "electron-updater";
import { FileLogger } from "../../core/src/logger";

export type UpdaterEvent = {
  state: "checking" | "available" | "downloaded" | "error" | "idle";
  message: string;
};

export function setupElectronUpdater(
  logger: FileLogger,
  onEvent?: (event: UpdaterEvent) => Promise<void> | void
): void {
  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    logger.log("launcher", "info", "Verificando atualizacoes do launcher");
    onEvent?.({ state: "checking", message: "Verificando atualizacoes do launcher" });
  });

  autoUpdater.on("update-available", (info) => {
    logger.log("launcher", "info", "Atualizacao do launcher disponivel", { version: info.version });
    onEvent?.({ state: "available", message: `Atualizacao encontrada: ${info.version}` });
  });

  autoUpdater.on("update-downloaded", (info) => {
    logger.log("launcher", "info", "Atualizacao do launcher baixada", { version: info.version });
    onEvent?.({ state: "downloaded", message: `Atualizacao pronta: ${info.version}` });
  });

  autoUpdater.on("error", (error) => {
    logger.log("launcher", "error", "Erro no updater", { message: error.message });
    onEvent?.({ state: "error", message: error.message });
  });
}

export async function checkForElectronUpdates(): Promise<void> {
  await autoUpdater.checkForUpdates();
}
