import crypto from 'node:crypto';
import { upsertAccount } from './accounts';

export function offlineUuid(username: string): string {
  const hash = crypto.createHash('md5');
  hash.update(`OfflinePlayer:${username}`, 'utf8');
  const hex = hash.digest('hex');
  return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
}

export async function loginOffline(username: string) {
  const uuid = offlineUuid(username);
  await upsertAccount({ type: 'offline', username, uuid });
  return uuid;
}
