import crypto from "node:crypto";
import { Auth, lexicon } from "msmc";
import {
  buildAvatarUrl,
  createMicrosoftAccountRecord,
  createRefreshTokenKey,
  findStoredAccount,
  SecretVault,
  upsertStoredAccount
} from "./accounts";
import { StoredMicrosoftAccount } from "../../shared/src";

const DEFAULT_PROMPT = "select_account";
const DEFAULT_ELECTRON_WINDOW = {
  width: 500,
  height: 650,
  resizable: false,
  autoHideMenuBar: true,
  title: "Entrar com Microsoft"
} as const;

type ResponseLike = {
  status?: number;
  text(): Promise<string>;
};

type MsmcLaunchAuthorization = {
  access_token: string;
  client_token?: string;
  uuid: string;
  name?: string;
  meta?: {
    type: "msa" | "mojang" | "legacy";
    exp?: number;
    refresh?: string;
    xuid?: string;
    demo?: boolean;
  };
  user_properties?: Record<string, unknown>;
};

type MsmcMinecraftToken = {
  exp?: number;
  profile?: {
    id: string;
    name: string;
    demo?: boolean;
    skins?: Array<{ url: string }>;
  };
  parent?: {
    msToken?: {
      refresh_token?: string;
    };
  };
  mclc(refreshable?: boolean): MsmcLaunchAuthorization;
};

type MsmcWrappedError = {
  ts?: string;
  response?: ResponseLike;
};

function getMicrosoftClientId(): string | undefined {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  return clientId || undefined;
}

function hasCustomMicrosoftClientId(): boolean {
  return Boolean(getMicrosoftClientId());
}

function trimErrorDetails(rawText: string): string | undefined {
  const text = rawText.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 320) : undefined;
}

async function readResponseDetails(response?: ResponseLike): Promise<string | undefined> {
  if (!response) {
    return undefined;
  }

  try {
    return trimErrorDetails(await response.text());
  } catch {
    return undefined;
  }
}

function translateMicrosoftCode(code: string, details?: string): string {
  if (details && /(redirect_uri|invalid client|invalid_client|unauthorized_client|client_id|app registration)/i.test(details)) {
    return "Configuracao Microsoft invalida. Revise MICROSOFT_CLIENT_ID e MS_REDIRECT_URI";
  }

  switch (code) {
    case "error.auth.microsoft":
      return "Falha no login Microsoft";
    case "error.auth.xboxLive":
      return "Falha ao autenticar com Xbox Live";
    case "error.auth.xsts.userNotFound":
      return "A conta Microsoft nao possui um perfil Xbox configurado";
    case "error.auth.xsts.bannedCountry":
      return "A conta Microsoft pertence a uma regiao sem suporte do Xbox Live";
    case "error.auth.xsts.child":
    case "error.auth.xsts.child.SK":
      return "A conta Microsoft exige aprovacao familiar no Xbox antes do login";
    case "error.auth.minecraft.login":
      return "Falha ao autenticar com Minecraft Services";
    case "error.auth.minecraft.profile":
      return "A conta Microsoft nao possui Minecraft Java ou o perfil nao pode ser carregado";
    case "error.auth.minecraft.entitlements":
      return "Falha ao validar a licenca do Minecraft Java";
    case "error.gui.closed":
      return "Login Microsoft cancelado pelo usuario";
    default: {
      const fallback = lexicon.getCode(code as never);
      return typeof fallback === "string" && fallback !== code ? fallback : "Falha ao autenticar conta Microsoft";
    }
  }
}

async function normalizeMicrosoftError(error: unknown, fallbackMessage: string): Promise<Error> {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(translateMicrosoftCode(error));
  }

  if (error && typeof error === "object") {
    const wrapped = error as MsmcWrappedError;
    if (wrapped.ts) {
      const details = await readResponseDetails(wrapped.response);
      const message = translateMicrosoftCode(wrapped.ts, details);
      return new Error(details ? `${message}: ${details}` : message);
    }
  }

  return new Error(fallbackMessage);
}

function isInvalidAppRegistrationMessage(message?: string): boolean {
  return Boolean(message && /(invalid app registration|invalid client|unauthorized_client|invalid_client|client_id|redirect_uri)/i.test(message));
}

async function shouldRetryWithDefaultMicrosoftAuth(error: unknown): Promise<boolean> {
  if (!hasCustomMicrosoftClientId()) {
    return false;
  }

  if (error instanceof Error) {
    return isInvalidAppRegistrationMessage(error.message);
  }

  if (typeof error === "string") {
    return isInvalidAppRegistrationMessage(error);
  }

  if (error && typeof error === "object") {
    const wrapped = error as MsmcWrappedError;
    if (wrapped.ts && isInvalidAppRegistrationMessage(wrapped.ts)) {
      return true;
    }
    const details = await readResponseDetails(wrapped.response);
    return isInvalidAppRegistrationMessage(details);
  }

  return false;
}

function toIsoDate(timestamp?: number): string | undefined {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

export function getMicrosoftRedirectUri(): string {
  const explicitRedirect = process.env.MS_REDIRECT_URI?.trim();
  if (explicitRedirect) {
    return explicitRedirect;
  }

  const host = process.env.MS_REDIRECT_HOST?.trim() || "127.0.0.1";
  const port = process.env.MS_REDIRECT_PORT?.trim() || "53682";
  return `http://${host}:${port}/callback`;
}

export function createDefaultMicrosoftAuthManager(): Auth {
  return new Auth(DEFAULT_PROMPT);
}

export function createMicrosoftAuthManager(redirectUri = getMicrosoftRedirectUri()): Auth {
  const clientId = getMicrosoftClientId();
  if (clientId) {
    return new Auth({
      client_id: clientId,
      redirect: redirectUri,
      prompt: DEFAULT_PROMPT
    });
  }

  return new Auth(DEFAULT_PROMPT);
}

export function buildMicrosoftAuthUrl(
  redirectUri = getMicrosoftRedirectUri(),
  authManager = createMicrosoftAuthManager(redirectUri)
): string {
  return authManager.createLink(redirectUri);
}

async function getMinecraftFromXbox(authPromise: Promise<{ getMinecraft(): Promise<unknown> }>): Promise<MsmcMinecraftToken> {
  const xbox = await authPromise;
  return (await xbox.getMinecraft()) as MsmcMinecraftToken;
}

function buildPersistedMicrosoftRecord(
  minecraft: MsmcMinecraftToken,
  input: {
    refreshTokenKey: string;
    existingId?: string;
    existingCreatedAt?: string;
  }
): StoredMicrosoftAccount {
  const authorization = minecraft.mclc();
  const profile = minecraft.profile;

  if (!authorization.access_token || !authorization.uuid) {
    throw new Error("MSMC nao retornou um token Minecraft valido");
  }

  return createMicrosoftAccountRecord({
    id: input.existingId,
    createdAt: input.existingCreatedAt,
    username: profile?.name || authorization.name || "player",
    uuid: profile?.id || authorization.uuid,
    accessToken: authorization.access_token,
    clientToken: authorization.client_token,
    accessTokenExpiresAt: toIsoDate(minecraft.exp || authorization.meta?.exp),
    avatarUrl: buildAvatarUrl(profile?.name || authorization.name || "player", undefined, profile?.id || authorization.uuid),
    refreshTokenKey: input.refreshTokenKey,
    xuid: authorization.meta?.xuid,
    isDemo: authorization.meta?.demo,
    lastValidatedAt: new Date().toISOString()
  });
}

async function persistMicrosoftAccount(
  minecraft: MsmcMinecraftToken,
  input: {
    refreshTokenKey: string;
    existingId?: string;
    existingCreatedAt?: string;
  },
  vault = new SecretVault()
): Promise<StoredMicrosoftAccount> {
  const refreshToken = minecraft.parent?.msToken?.refresh_token;
  if (!refreshToken) {
    throw new Error("MSMC nao retornou o refresh token da conta Microsoft");
  }

  await vault.set(input.refreshTokenKey, refreshToken);
  const record = buildPersistedMicrosoftRecord(minecraft, input);
  await upsertStoredAccount(record);
  return record;
}

export function buildMicrosoftLaunchAuthorization(account: StoredMicrosoftAccount): MsmcLaunchAuthorization {
  return {
    access_token: account.accessToken,
    client_token: account.clientToken || crypto.randomUUID(),
    uuid: account.uuid,
    name: account.username,
    user_properties: {},
    meta: {
      type: "msa",
      xuid: account.xuid,
      demo: account.isDemo
    }
  };
}

export async function loginMicrosoftFromAuthorizationCode(
  code: string,
  redirectUri = getMicrosoftRedirectUri(),
  vault = new SecretVault(),
  authManager = createMicrosoftAuthManager(redirectUri)
): Promise<StoredMicrosoftAccount> {
  try {
    const xbox = await authManager.login(code, redirectUri);
    const minecraft = (await xbox.getMinecraft()) as MsmcMinecraftToken;
    return persistMicrosoftAccount(
      minecraft,
      {
        refreshTokenKey: createRefreshTokenKey(crypto.randomUUID())
      },
      vault
    );
  } catch (error) {
    throw await normalizeMicrosoftError(error, "Falha ao concluir login Microsoft");
  }
}

export async function loginMicrosoftInElectronPopup(
  vault = new SecretVault(),
  windowProperties: Record<string, unknown> = {},
  authManager = createDefaultMicrosoftAuthManager()
): Promise<StoredMicrosoftAccount> {
  try {
    const minecraft = await getMinecraftFromXbox(
      authManager.launch("electron", {
        ...DEFAULT_ELECTRON_WINDOW,
        ...windowProperties
      })
    );

    return persistMicrosoftAccount(
      minecraft,
      {
        refreshTokenKey: createRefreshTokenKey(crypto.randomUUID())
      },
      vault
    );
  } catch (error) {
    throw await normalizeMicrosoftError(error, "Falha ao concluir login Microsoft");
  }
}

export async function refreshMicrosoftAccount(account: StoredMicrosoftAccount, vault = new SecretVault()): Promise<StoredMicrosoftAccount> {
  const refreshToken = await vault.get(account.refreshTokenKey);
  if (!refreshToken) {
    throw new Error("Refresh token nao encontrado");
  }

  try {
    const authManager = createMicrosoftAuthManager();
    const minecraft = await getMinecraftFromXbox(authManager.refresh(refreshToken));
    return persistMicrosoftAccount(
      minecraft,
      {
        refreshTokenKey: account.refreshTokenKey,
        existingId: account.id,
        existingCreatedAt: account.createdAt
      },
      vault
    );
  } catch (error) {
    if (await shouldRetryWithDefaultMicrosoftAuth(error)) {
      try {
        const fallbackAuthManager = createDefaultMicrosoftAuthManager();
        const minecraft = await getMinecraftFromXbox(fallbackAuthManager.refresh(refreshToken));
        return persistMicrosoftAccount(
          minecraft,
          {
            refreshTokenKey: account.refreshTokenKey,
            existingId: account.id,
            existingCreatedAt: account.createdAt
          },
          vault
        );
      } catch (fallbackError) {
        throw await normalizeMicrosoftError(fallbackError, "Falha ao atualizar sessao Microsoft");
      }
    }
    throw await normalizeMicrosoftError(error, "Falha ao atualizar sessao Microsoft");
  }
}

export async function refreshMicrosoftAccountById(accountId: string, vault = new SecretVault()): Promise<StoredMicrosoftAccount> {
  const account = await findStoredAccount(accountId);
  if (!account || account.type !== "microsoft") {
    throw new Error("Conta Microsoft nao encontrada");
  }
  return refreshMicrosoftAccount(account, vault);
}
