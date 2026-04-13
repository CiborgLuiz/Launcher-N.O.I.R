try {
  // Optional: allow running without dotenv installed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {}
const fetch = (...args: any[]) => import('node-fetch').then((m) => (m.default as any)(...args));
import crypto from 'node:crypto';
import keytar from 'keytar';
import { upsertAccount, MicrosoftAccount } from './accounts';
import { log } from '../../launcher-core/src/logger';

const clientId = process.env.MICROSOFT_CLIENT_ID || '09c1ae60-5922-43d7-8d60-e7a8088cb090';
const scope = 'XboxLive.signin offline_access';

let deviceCodeState: {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
} | null = null;

export async function startDeviceCodeFlow() {
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID nao configurado');
  }
  const body = new URLSearchParams({
    client_id: clientId,
    scope
  });
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    throw new Error('Falha ao iniciar device code');
  }
  const data = (await res.json()) as any;
  deviceCodeState = {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval
  };
  await log({ ts: new Date().toISOString(), level: 'INFO', message: 'Device code gerado.' });
  return { userCode: data.user_code, verificationUri: data.verification_uri };
}

async function pollDeviceCode() {
  if (!deviceCodeState) throw new Error('Device code nao iniciado');
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCodeState.deviceCode
  });
  while (true) {
    const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = (await res.json()) as any;
    if (data.error === 'authorization_pending') {
      await new Promise((r) => setTimeout(r, deviceCodeState!.interval * 1000));
      continue;
    }
    if (data.error) {
      throw new Error(`OAuth error: ${data.error}`);
    }
    return data as { access_token: string; refresh_token: string };
  }
}

async function xboxLiveAuth(msAccessToken: string) {
  const res = await fetch('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        AuthMethod: 'RPS',
        SiteName: 'user.auth.xboxlive.com',
        RpsTicket: `d=${msAccessToken}`
      },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  });
  if (!res.ok) {
    throw new Error('Falha no Xbox Live Auth');
  }
  return (await res.json()) as any;
}

async function xstsAuth(xblToken: string) {
  const res = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });
  if (!res.ok) {
    throw new Error('Falha no XSTS');
  }
  const data = (await res.json()) as any;
  if (!data?.DisplayClaims?.xui?.[0]?.uhs) {
    throw new Error(`XSTS sem user hash. Resposta: ${JSON.stringify(data)}`);
  }
  return data;
}

async function minecraftAuth(xstsToken: string, userHash: string) {
  if (!userHash) {
    throw new Error('User hash inexistente para Minecraft auth');
  }
  const res = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${userHash};${xstsToken}` })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao autenticar Minecraft Services: ${text}`);
  }
  return (await res.json()) as any;
}

async function minecraftEntitlements(mcAccessToken: string) {
  const res = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: { Authorization: `Bearer ${mcAccessToken}` }
  });
  if (!res.ok) {
    throw new Error('Falha ao verificar entitlements');
  }
  return (await res.json()) as any;
}

async function minecraftProfile(mcAccessToken: string) {
  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${mcAccessToken}` }
  });
  if (!res.ok) {
    throw new Error('Falha ao obter perfil Minecraft');
  }
  return (await res.json()) as any;
}

export async function completeDeviceCodeFlow(): Promise<MicrosoftAccount> {
  const tokens = await pollDeviceCode();
  return completeMicrosoftLoginWithTokens(tokens.access_token, tokens.refresh_token);
}

function base64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function buildAuthUrl(redirectUri: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope,
    prompt: 'select_account',
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });
  return `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string) {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope
  });
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) {
    throw new Error('Falha ao trocar code por token');
  }
  return (await res.json()) as { access_token: string; refresh_token: string };
}

export async function completeMicrosoftLoginWithTokens(
  msAccessToken: string,
  refreshToken: string
): Promise<MicrosoftAccount> {
  const xbl = await xboxLiveAuth(msAccessToken);
  const xsts = await xstsAuth(xbl.Token);
  const userHash = xsts?.DisplayClaims?.xui?.[0]?.uhs;
  if (!userHash) {
    throw new Error(`XSTS sem user hash. Resposta: ${JSON.stringify(xsts)}`);
  }
  const mc = await minecraftAuth(xsts.Token, userHash);
  const entitlements = await minecraftEntitlements(mc.access_token);
  if (!entitlements?.items || entitlements.items.length === 0) {
    throw new Error('Conta nao possui Minecraft Java');
  }
  const profile = await minecraftProfile(mc.access_token);

  const account: MicrosoftAccount = {
    type: 'microsoft',
    username: profile.name,
    uuid: profile.id,
    accessToken: mc.access_token,
    refreshToken,
    skin: profile.skins?.[0]?.url || ''
  };
  if (account.refreshToken) {
    await keytar.setPassword('noir-launcher', account.uuid, account.refreshToken);
  }
  await upsertAccount(account);
  await log({ ts: new Date().toISOString(), level: 'INFO', message: 'Conta Microsoft adicionada.' });
  return account;
}

export async function refreshMicrosoftAccount(account: MicrosoftAccount): Promise<MicrosoftAccount> {
  if (!clientId) return account;
  const storedRefresh = account.refreshToken || (await keytar.getPassword('noir-launcher', account.uuid)) || '';
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: storedRefresh,
    scope
  });
  const res = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) return account;
  const data = (await res.json()) as any;

  const xbl = await xboxLiveAuth(data.access_token);
  const xsts = await xstsAuth(xbl.Token);
  const userHash = xsts?.DisplayClaims?.xui?.[0]?.uhs;
  if (!userHash) return account;
  const mc = await minecraftAuth(xsts.Token, userHash);
  const entitlements = await minecraftEntitlements(mc.access_token);
  if (!entitlements?.items || entitlements.items.length === 0) return account;
  const profile = await minecraftProfile(mc.access_token);

  const refreshed: MicrosoftAccount = {
    ...account,
    username: profile.name,
    uuid: profile.id,
    accessToken: mc.access_token,
    refreshToken: data.refresh_token || storedRefresh,
    skin: profile.skins?.[0]?.url || account.skin
  };
  if (refreshed.refreshToken) {
    await keytar.setPassword('noir-launcher', refreshed.uuid, refreshed.refreshToken);
  }
  await upsertAccount(refreshed);
  return refreshed;
}
