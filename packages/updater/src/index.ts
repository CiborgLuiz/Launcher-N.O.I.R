import { autoUpdater } from "electron-updater";
import { FileLogger } from "../../core/src/logger";

export type UpdaterEvent = {
  state: "checking" | "available" | "downloading" | "downloaded" | "error" | "idle";
  message: string;
};

type UpdaterError = Error & {
  code?: string;
};

function isNoPublishedReleaseError(error: unknown): error is UpdaterError {
  if (!(error instanceof Error)) {
    return false;
  }

  const candidate = error as UpdaterError;
  return (
    candidate.code === "ERR_UPDATER_LATEST_VERSION_NOT_FOUND" ||
    /Unable to find latest version on GitHub/i.test(candidate.message) ||
    /No published versions on GitHub/i.test(candidate.message)
  );
}

function formatUpdaterError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Falha desconhecida ao verificar atualizacoes do launcher";
  }

  if (isNoPublishedReleaseError(error)) {
    return "Nenhuma release publicada no GitHub ainda.";
  }

  return error.message;
}

export function setupElectronUpdater(
  logger: FileLogger,
  onEvent?: (event: UpdaterEvent) => Promise<void> | void
): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;

  autoUpdater.on("checking-for-update", () => {
    logger.log("launcher", "info", "Verificando atualizacoes do launcher");
    onEvent?.({ state: "checking", message: "Verificando atualizacoes do launcher" });
  });

  autoUpdater.on("update-available", (info) => {
    logger.log("launcher", "info", "Atualizacao do launcher disponivel", { version: info.version });
    onEvent?.({ state: "available", message: `Atualizacao encontrada: ${info.version}` });
  });

  autoUpdater.on("update-not-available", () => {
    logger.log("launcher", "info", "Launcher ja esta na versao mais recente");
    onEvent?.({ state: "idle", message: "Launcher ja esta atualizado." });
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.max(1, Math.round(progress.percent));
    onEvent?.({ state: "downloading", message: `Baixando atualizacao: ${percent}%` });
  });

  autoUpdater.on("update-downloaded", (info) => {
    logger.log("launcher", "info", "Atualizacao do launcher baixada", { version: info.version });
    onEvent?.({ state: "downloaded", message: `Atualizacao pronta: ${info.version}. Reiniciando launcher...` });
  });

  autoUpdater.on("error", (error) => {
    if (isNoPublishedReleaseError(error)) {
      logger.log("launcher", "info", "Nenhuma release publicada para auto update ainda");
      onEvent?.({ state: "idle", message: formatUpdaterError(error) });
      return;
    }

    logger.log("launcher", "error", "Erro no updater", { message: error.message });
    onEvent?.({ state: "error", message: formatUpdaterError(error) });
  });
}

export async function checkForElectronUpdates(): Promise<void> {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    if (isNoPublishedReleaseError(error)) {
      return;
    }
    throw error;
  }
}

export function installDownloadedElectronUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
