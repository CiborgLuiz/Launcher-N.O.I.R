import { Authenticator, Client } from "minecraft-launcher-core";
import { StoredAccount, StoredMicrosoftAccount } from "../../shared/src";
import { LauncherSettings, InstanceMetadata } from "../../shared/src";
import { LauncherPaths } from "../../instance-manager/src";
import { refreshMicrosoftAccount } from "../../auth/src";
import { FileLogger } from "../../core/src/logger";
import { ensureJavaRuntime, getRequiredJavaVersion } from "./java";

type LaunchCallbacks = {
  onStatus?: (event: { state: "started" | "exited" | "error"; message: string; durationMs?: number }) => Promise<void> | void;
};

function buildAuthorization(account: StoredAccount) {
  if (account.type === "offline") {
    return Authenticator.getAuth(account.username);
  }

  return {
    access_token: account.accessToken,
    uuid: account.uuid,
    name: account.username,
    user_properties: {},
    meta: {
      type: "msa"
    }
  };
}

async function resolveLaunchAccount(account: StoredAccount): Promise<StoredAccount> {
  if (account.type !== "microsoft") {
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
  const account = await resolveLaunchAccount(params.account);
  const requiredJavaVersion = getRequiredJavaVersion(
    params.instance.minecraftVersion,
    params.instance.javaVersionRequired
  );
  const javaPath = await ensureJavaRuntime(requiredJavaVersion, params.paths, params.settings.javaPath);
  const startedAt = Date.now();
  const launcher = new Client();

  launcher.on("debug", (message) => {
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

  try {
    await params.onStatus?.({ state: "started", message: "Minecraft iniciado" });
    await launcher.launch({
      authorization: buildAuthorization(account) as never,
      root: params.paths.gameDir,
      javaPath,
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
          ? `${params.instance.modLoader}-${params.instance.minecraftVersion}-${params.instance.modLoaderVersion}`
          : undefined,
      fabric: params.instance.modLoader === "fabric" ? params.instance.modLoaderVersion : undefined,
      quilt: params.instance.modLoader === "quilt" ? params.instance.modLoaderVersion : undefined,
      neoforge: params.instance.modLoader === "neoforge" ? params.instance.modLoaderVersion : undefined
    } as never);

    const durationMs = Date.now() - startedAt;
    await params.logger.log("launcher", "info", "Minecraft finalizado", { durationMs });
    await params.onStatus?.({ state: "exited", message: "Minecraft encerrado", durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao iniciar Minecraft";
    await params.logger.log("launcher", "error", message);
    await params.onStatus?.({ state: "error", message });
    throw error;
  }
}
