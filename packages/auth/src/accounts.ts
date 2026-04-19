import crypto from "node:crypto";
import { loadAccountsStore, saveAccountsStore } from "../../instance-manager/src";
import { AccountSummary, StoredAccount, StoredMicrosoftAccount, toAccountSummary } from "../../shared/src";
import { SecretVault } from "./secrets";

function uniqueUrls(urls: Array<string | undefined>): string[] {
  return [...new Set(urls.filter((value): value is string => Boolean(value?.trim())))];
}

function isCrafatarUrl(url: string): boolean {
  return /crafatar\.com/i.test(url);
}

export function buildAvatarCandidates(input: {
  username?: string;
  uuid?: string;
  explicitUrl?: string;
  size?: number;
}): string[] {
  const size = input.size ?? 128;
  const encodedUuid = input.uuid ? encodeURIComponent(input.uuid) : undefined;
  const encodedUsername = input.username ? encodeURIComponent(input.username) : undefined;

  return uniqueUrls([
    input.explicitUrl && !isCrafatarUrl(input.explicitUrl) ? input.explicitUrl : undefined,
    encodedUuid ? `https://mc-heads.net/avatar/${encodedUuid}/${size}` : undefined,
    encodedUsername ? `https://minotar.net/helm/${encodedUsername}/${size}` : undefined,
    input.explicitUrl,
    encodedUuid ? `https://crafatar.com/avatars/${encodedUuid}?size=${size}&overlay` : undefined
  ]);
}

export function buildAvatarUrl(username: string, explicitUrl?: string, uuid?: string): string {
  return buildAvatarCandidates({ username, uuid, explicitUrl })[0] || "";
}

export function createRefreshTokenKey(accountId: string): string {
  return `microsoft-refresh:${accountId}`;
}

export async function listStoredAccounts() {
  return loadAccountsStore();
}

export async function listAccountSummaries(vault = new SecretVault()): Promise<AccountSummary[]> {
  const store = await loadAccountsStore();
  const orderedAccounts = [...store.accounts].sort((left, right) => {
    if (left.id === store.selectedAccountId) return -1;
    if (right.id === store.selectedAccountId) return 1;
    return 0;
  });
  return Promise.all(
    orderedAccounts.map(async (account) => {
      const hasRefreshToken =
        account.type === "microsoft" ? Boolean(await vault.get(account.refreshTokenKey)) : true;
      return {
        ...toAccountSummary(account, hasRefreshToken),
        avatarUrl: buildAvatarUrl(account.username, account.avatarUrl, account.uuid)
      };
    })
  );
}

export async function findStoredAccount(id: string): Promise<StoredAccount | undefined> {
  const store = await loadAccountsStore();
  return store.accounts.find((account) => account.id === id || account.uuid === id);
}

export async function saveSelectedAccount(accountId: string | undefined): Promise<void> {
  const store = await loadAccountsStore();
  store.selectedAccountId = accountId;
  await saveAccountsStore(store);
}

export async function upsertStoredAccount(account: StoredAccount): Promise<StoredAccount> {
  const store = await loadAccountsStore();
  const index = store.accounts.findIndex((existing) => existing.id === account.id || existing.uuid === account.uuid);
  if (index >= 0) {
    const previous = store.accounts[index];
    store.accounts[index] = account;
    if (store.selectedAccountId === previous.id) {
      store.selectedAccountId = account.id;
    }
  } else {
    store.accounts.push(account);
  }
  if (!store.selectedAccountId) {
    store.selectedAccountId = account.id;
  }
  await saveAccountsStore(store);
  return account;
}

export async function removeStoredAccount(accountId: string, vault = new SecretVault()): Promise<void> {
  const store = await loadAccountsStore();
  const target = store.accounts.find((account) => account.id === accountId || account.uuid === accountId);
  if (target?.type === "microsoft") {
    await vault.delete(target.refreshTokenKey);
  }
  store.accounts = store.accounts.filter((account) => account.id !== accountId && account.uuid !== accountId);
  if (store.selectedAccountId === accountId || store.selectedAccountId === target?.uuid) {
    store.selectedAccountId = store.accounts[0]?.id;
  }
  await saveAccountsStore(store);
}

export function createOfflineAccount(username: string): StoredAccount {
  const id = crypto.randomUUID();
  return {
    id,
    type: "offline",
    username,
    uuid: crypto.randomUUID().replace(/-/g, ""),
    avatarUrl: buildAvatarUrl(username),
    createdAt: new Date().toISOString()
  };
}

export function createMicrosoftAccountRecord(input: {
  id?: string;
  createdAt?: string;
  username: string;
  uuid: string;
  accessToken: string;
  clientToken?: string;
  accessTokenExpiresAt?: string;
  avatarUrl?: string;
  refreshTokenKey: string;
  xuid?: string;
  isDemo?: boolean;
  lastValidatedAt?: string;
}): StoredMicrosoftAccount {
  return {
    id: input.id || crypto.randomUUID(),
    type: "microsoft",
    username: input.username,
    uuid: input.uuid,
    accessToken: input.accessToken,
    clientToken: input.clientToken,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    avatarUrl: buildAvatarUrl(input.username, input.avatarUrl, input.uuid),
    refreshTokenKey: input.refreshTokenKey,
    xuid: input.xuid,
    isDemo: input.isDemo,
    lastValidatedAt: input.lastValidatedAt,
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function isAccessTokenExpired(account: StoredMicrosoftAccount): boolean {
  if (!account.accessTokenExpiresAt) {
    return false;
  }
  return new Date(account.accessTokenExpiresAt).getTime() - 30_000 <= Date.now();
}

export async function getSelectedStoredAccount(): Promise<StoredAccount | undefined> {
  const store = await loadAccountsStore();
  return store.accounts.find((account) => account.id === store.selectedAccountId) || store.accounts[0];
}

export { SecretVault };
