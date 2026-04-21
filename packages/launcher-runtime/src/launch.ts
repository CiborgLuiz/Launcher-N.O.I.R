import { Authenticator, Client } from "minecraft-launcher-core";
import { StoredAccount, StoredMicrosoftAccount } from "../../shared/src";
import { LauncherSettings, InstanceMetadata } from "../../shared/src";
import { LauncherPaths } from "../../instance-manager/src";
import { buildMicrosoftLaunchAuthorization, isAccessTokenExpired, refreshMicrosoftAccount } from "../../auth/src";
import { FileLogger } from "../../core/src/logger";
import {
  ensureForgeInstaller,
  invalidateStaleForgeVersionCache,
  readForgeInstallerManifest,
  resolveForgeJvmArgs
} from "./forge";
import { ensureJavaRuntime, getRequiredJavaVersion } from "./java";

type LaunchCallbacks = {
  onStatus?: (event: { state: "started" | "exited" | "error"; message: string; durationMs?: number }) => Promise<void> | void;
};

function buildAuthorization(account: StoredAccount) {
  if (account.type === "offline") {
    return Authenticator.getAuth(account.username);
  }

  return buildMicrosoftLaunchAuthorization(account as StoredMicrosoftAccount);
}

async function resolveLaunchAccount(account: StoredAccount): Promise<StoredAccount> {
  if (account.type !== "microsoft") {
    return account;
  }

  if (!isAccessTokenExpired(account as StoredMicrosoftAccount)) {
    return account;
  }

  return refreshMicrosoftAccount(account as StoredMicrosoftAccount);
}

export async function launchMinecraftInstance(
  params: {
    account: StoredAccount;
    settings: LauncherSettings;
    instance: InstanceMetadata;
    paths: LauncherPaths;
    logger: FileLogger;
  } & LaunchCallbacks
): Promise<void> {
  const startedAt = Date.now();
  let latestDebugMessage = "";

  try {
    const account = await resolveLaunchAccount(params.account);
    const requiredJavaVersion = getRequiredJavaVersion(
      params.instance.minecraftVersion,
      params.instance.javaVersionRequired
    );
    const javaPath = await ensureJavaRuntime(requiredJavaVersion, params.paths, params.settings.javaPath);
    const launcher = new Client();

    launcher.on("debug", (message) => {
      latestDebugMessage = `${message}`;
      params.logger.log("launcher", "info", `${message}`);
    });
    launcher.on("data", (message) => {
      params.logger.log("minecraft", "info", `${message}`);
    });
    launcher.on("progress", (payload) => {
      params.logger.log("launcher", "info", "Progresso do runtime", payload as Record<string, unknown>);
    });

    await params.logger.log("launcher", "info", "Iniciando Minecraft", {
      accountId: account.id,
      version: params.instance.minecraftVersion,
      modLoader: params.instance.modLoader
    });
    let customArgs: string[] | undefined;
    const forgeInstallerPath =
      params.instance.modLoader === "forge"
        ? await ensureForgeInstaller(params.instance.minecraftVersion, params.instance.modLoaderVersion, params.paths, params.logger)
        : undefined;

    if (forgeInstallerPath) {
      const forgeManifest = await readForgeInstallerManifest(forgeInstallerPath);
      if (forgeManifest) {
        await invalidateStaleForgeVersionCache(
          params.instance.minecraftVersion,
          forgeManifest.id,
          params.paths,
          params.logger
        );
        customArgs = resolveForgeJvmArgs(forgeManifest, params.paths.librariesDir);
      }
    }

    const minecraft = await launcher.launch({
      authorization: buildAuthorization(account) as never,
      root: params.paths.gameDir,
      javaPath,
      customArgs,
      memory: {
        min: `${params.settings.minimumRamMb}M`,
        max: `${params.settings.maximumRamMb}M`
      },
      window: {
        width: params.settings.resolutionWidth,
        height: params.settings.resolutionHeight,
        fullscreen: params.settings.fullscreen
      },
      version: {
        number: params.instance.minecraftVersion,
        type: "release"
      },
      forge:
        params.instance.modLoader === "forge"
          ? forgeInstallerPath
          : undefined,
      fabric: params.instance.modLoader === "fabric" ? params.instance.modLoaderVersion : undefined,
      quilt: params.instance.modLoader === "quilt" ? params.instance.modLoaderVersion : undefined,
      neoforge: params.instance.modLoader === "neoforge" ? params.instance.modLoaderVersion : undefined
    } as never);

    const hasValidProcess = Boolean(minecraft && typeof minecraft.once === "function");

    if (!hasValidProcess) {
      const detail = latestDebugMessage || "Sem detalhes adicionais no log de debug do MCLC";
      throw new Error(`minecraft-launcher-core nao retornou um processo valido. Detalhe: ${detail}`);
    }

    const minecraftProcess = minecraft as any;

    await params.onStatus?.({ state: "started", message: "Minecraft iniciado" });

    await new Promise<void>((resolve, reject) => {
      minecraftProcess.once("error", (error: Error) => {
        reject(error);
      });

      minecraftProcess.once("close", async (code: number | null) => {
        const durationMs = Date.now() - startedAt;
        if (code && code !== 0) {
          reject(new Error(`Minecraft encerrado com codigo ${code}`));
          return;
        }

        await params.logger.log("launcher", "info", "Minecraft finalizado", { durationMs, code: code ?? 0 });
        await params.onStatus?.({ state: "exited", message: "Minecraft encerrado", durationMs });
        resolve();
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao iniciar Minecraft";
    await params.logger.log("launcher", "error", message);
    await params.onStatus?.({ state: "error", message });
    throw error;
  }
}
