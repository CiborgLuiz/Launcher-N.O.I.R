const fetch = (...args: Parameters<typeof import("node-fetch")["default"]>) =>
  import("node-fetch").then((module) => module.default(...args));
import crypto from "node:crypto";
import { findStoredAccount, upsertStoredAccount, createMicrosoftAccountRecord, createRefreshTokenKey, SecretVault } from "./accounts";
import { StoredMicrosoftAccount } from "../../shared/src";

const SCOPE = "XboxLive.signin offline_access openid profile email";

function getClientId(): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID nao configurado");
  }
  return clientId;
}

function normalizeMicrosoftServiceError(prefix: string, rawText: string): Error {
  if (/Invalid app registration/i.test(rawText)) {
    return new Error(
      "App registration Microsoft invalido. Atualize o MICROSOFT_CLIENT_ID no .env com um app seu do Microsoft Entra, com Public Client Flow habilitado e redirect URI local configurado."
    );
  }
  return new Error(`${prefix}: ${rawText}`);
}

export function getMicrosoftRedirectUri(): string {
  return (
    process.env.MS_REDIRECT_URI ||
    `http://${process.env.MS_REDIRECT_HOST || "127.0.0.1"}:${process.env.MS_REDIRECT_PORT || "53682"}/callback`
  );
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = toBase64Url(crypto.randomBytes(32));
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function buildMicrosoftAuthUrl(redirectUri: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPE,
    prompt: "select_account",
    code_challenge_method: "S256",
    code_challenge: codeChallenge
  });

  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
}

type MicrosoftOAuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function requestMicrosoftToken(body: URLSearchParams): Promise<MicrosoftOAuthTokens> {
  const response = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no OAuth Microsoft: ${text}`);
  }
  return (await response.json()) as MicrosoftOAuthTokens;
}

export async function exchangeCodeForTokens(code: string, verifier: string, redirectUri: string): Promise<MicrosoftOAuthTokens> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: SCOPE
  });
  return requestMicrosoftToken(body);
}

async function refreshTokens(refreshToken: string): Promise<MicrosoftOAuthTokens> {
  const body = new URLSearchParams({
    client_id: getClientId(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPE
  });
  return requestMicrosoftToken(body);
}

async function xboxLiveAuth(msAccessToken: string): Promise<any> {
  const response = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    })
  });
  if (!response.ok) {
    throw new Error("Falha no login Xbox Live");
  }
  return response.json();
}

async function xstsAuth(xblToken: string): Promise<any> {
  const response = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken]
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT"
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha no XSTS: ${text}`);
  }
  return response.json();
}

async function minecraftAuth(xstsToken: string, userHash: string): Promise<{ access_token: string; expires_in: number }> {
  const response = await fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` })
  });
  if (!response.ok) {
    const text = await response.text();
    throw normalizeMicrosoftServiceError("Falha ao autenticar Minecraft Services", text);
  }
  return (await response.json()) as { access_token: string; expires_in: number };
}

async function verifyEntitlements(accessToken: string): Promise<void> {
  const response = await fetch("https://api.minecraftservices.com/entitlements/mcstore", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    throw new Error("Falha ao verificar licenca do Minecraft");
  }
  const data = (await response.json()) as { items?: unknown[] };
  if (!data.items || data.items.length === 0) {
    throw new Error("A conta Microsoft nao possui Minecraft Java");
  }
}

async function fetchMinecraftProfile(accessToken: string): Promise<{ id: string; name: string; skins?: Array<{ url: string }> }> {
  const response = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const text = await response.text();
    throw normalizeMicrosoftServiceError("Falha ao obter perfil Minecraft", text);
  }
  return (await response.json()) as { id: string; name: string; skins?: Array<{ url: string }> };
}

async function completeMinecraftChain(msAccessToken: string): Promise<{
  accessToken: string;
  accessTokenExpiresAt: string;
  username: string;
  uuid: string;
  avatarUrl?: string;
}> {
  const xbl = await xboxLiveAuth(msAccessToken);
  const xsts = await xstsAuth(xbl.Token);
  const userHash = xsts?.DisplayClaims?.xui?.[0]?.uhs;
  if (!userHash) {
    throw new Error("XSTS nao retornou user hash");
  }
  const mc = await minecraftAuth(xsts.Token, userHash);
  await verifyEntitlements(mc.access_token);
  const profile = await fetchMinecraftProfile(mc.access_token);
  return {
    accessToken: mc.access_token,
    accessTokenExpiresAt: new Date(Date.now() + mc.expires_in * 1000).toISOString(),
    username: profile.name,
    uuid: profile.id,
    avatarUrl: profile.skins?.[0]?.url
  };
}

async function persistMicrosoftAccount(
  input: {
    msAccessToken: string;
    refreshToken: string;
    refreshTokenKey: string;
    existingId?: string;
  },
  vault = new SecretVault()
): Promise<StoredMicrosoftAccount> {
  const profile = await completeMinecraftChain(input.msAccessToken);
  await vault.set(input.refreshTokenKey, input.refreshToken);
  const record = createMicrosoftAccountRecord({
    id: input.existingId,
    username: profile.username,
    uuid: profile.uuid,
    accessToken: profile.accessToken,
    accessTokenExpiresAt: profile.accessTokenExpiresAt,
    avatarUrl: profile.avatarUrl,
    refreshTokenKey: input.refreshTokenKey,
    lastValidatedAt: new Date().toISOString()
  });
  await upsertStoredAccount(record);
  return record;
}

export async function loginMicrosoftFromAuthorizationCode(
  code: string,
  verifier: string,
  redirectUri: string,
  vault = new SecretVault()
): Promise<StoredMicrosoftAccount> {
  const tokens = await exchangeCodeForTokens(code, verifier, redirectUri);
  const refreshTokenKey = createRefreshTokenKey(crypto.randomUUID());
  return persistMicrosoftAccount(
    {
      msAccessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      refreshTokenKey
    },
    vault
  );
}

export async function refreshMicrosoftAccount(account: StoredMicrosoftAccount, vault = new SecretVault()): Promise<StoredMicrosoftAccount> {
  const refreshToken = await vault.get(account.refreshTokenKey);
  if (!refreshToken) {
    throw new Error("Refresh token nao encontrado");
  }
  const refreshed = await refreshTokens(refreshToken);
  return persistMicrosoftAccount(
    {
      msAccessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      refreshTokenKey: account.refreshTokenKey,
      existingId: account.id
    },
    vault
  );
}

export async function refreshMicrosoftAccountById(accountId: string, vault = new SecretVault()): Promise<StoredMicrosoftAccount> {
  const account = await findStoredAccount(accountId);
  if (!account || account.type !== "microsoft") {
    throw new Error("Conta Microsoft nao encontrada");
  }
  return refreshMicrosoftAccount(account, vault);
}
