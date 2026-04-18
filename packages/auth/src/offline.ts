import { createOfflineAccount, upsertStoredAccount } from "./accounts";

export function isDevOfflineEnabled(): boolean {
  return true;
}

export async function createOfflineDevAccount(username: string) {
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    throw new Error("Informe um nickname com ao menos 3 caracteres");
  }
  const account = createOfflineAccount(trimmed);
  await upsertStoredAccount(account);
  return account;
}
