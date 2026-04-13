import fs from 'fs-extra';
import { accountsPath, ensureBaseDirs } from '../../config-system/src/paths';

export type MicrosoftAccount = {
  type: 'microsoft';
  username: string;
  uuid: string;
  accessToken: string;
  refreshToken: string;
  skin: string;
};

export type OfflineAccount = {
  type: 'offline';
  username: string;
  uuid: string;
};

export type Account = MicrosoftAccount | OfflineAccount;

export type AccountStore = { accounts: Account[] };

const defaults: AccountStore = { accounts: [] };

export async function loadAccounts(): Promise<AccountStore> {
  await ensureBaseDirs();
  if (!(await fs.pathExists(accountsPath))) {
    await fs.writeJson(accountsPath, defaults, { spaces: 2 });
    return defaults;
  }
  const data = await fs.readJson(accountsPath);
  return { ...defaults, ...data };
}

export async function saveAccounts(store: AccountStore): Promise<void> {
  await ensureBaseDirs();
  await fs.writeJson(accountsPath, store, { spaces: 2 });
}

export async function upsertAccount(account: Account): Promise<void> {
  const store = await loadAccounts();
  const idx = store.accounts.findIndex((a) => a.uuid === account.uuid);
  if (idx >= 0) {
    store.accounts[idx] = account;
  } else {
    store.accounts.push(account);
  }
  await saveAccounts(store);
}

export async function findAccount(uuid: string): Promise<Account | undefined> {
  const store = await loadAccounts();
  return store.accounts.find((a) => a.uuid === uuid);
}

export async function removeAccount(uuid: string): Promise<void> {
  const store = await loadAccounts();
  store.accounts = store.accounts.filter((a) => a.uuid !== uuid);
  await saveAccounts(store);
}
