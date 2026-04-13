import { createOfflineAccount, upsertStoredAccount } from "./accounts";

export function isDevOfflineEnabled(): boolean {
  return process.env.NOIR_ENABLE_DEV_OFFLINE === "true" && process.env.NODE_ENV !== "production";
}

export async function createOfflineDevAccount(username: string) {
  if (!isDevOfflineEnabled()) {
    throw new Error("Modo offline de desenvolvimento desativado");
  }
  const trimmed = username.trim();
  if (trimmed.length < 3) {
    throw new Error("Informe um nickname com ao menos 3 caracteres");
  }
  const account = createOfflineAccount(trimmed);
  await upsertStoredAccount(account);
  return account;
}
