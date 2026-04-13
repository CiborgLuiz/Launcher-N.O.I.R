import { Client, Authenticator } from 'minecraft-launcher-core';
import { Account } from '../../auth-system/src/accounts';
import { refreshMicrosoftAccount } from '../../auth-system/src/microsoft';
import { readInstanceConfig, updateLastPlayed, noirInstanceRoot } from '../../instance-manager/src/instances';
import { Settings } from '../../config-system/src/settings';
import { ensureJava, javaVersionForMinecraft } from '../../installer/src/java';
import { log, logMinecraft } from '../../launcher-core/src/logger';

export async function launchMinecraft(account: Account, settings: Settings) {
  const config = await readInstanceConfig();
  const version = config.minecraftVersion;
  const javaPath = await ensureJava(javaVersionForMinecraft(version));

  const launcher = new Client();
  const root = noirInstanceRoot;
  const memoryMax = `${Math.max(settings.ram, config.memory)}M`;
  const memoryMin = `${Math.max(1024, Math.floor(Math.max(settings.ram, config.memory) / 2))}M`;

  const resolvedAccount = account.type === 'microsoft' ? await refreshMicrosoftAccount(account) : account;
  if (resolvedAccount.type === 'microsoft' && !resolvedAccount.accessToken) {
    throw new Error('Token Microsoft invalido');
  }
  const auth =
    resolvedAccount.type === 'microsoft'
      ? {
          access_token: resolvedAccount.accessToken,
          uuid: resolvedAccount.uuid,
          name: resolvedAccount.username,
          user_properties: {},
          meta: {
            type: 'msa'
          }
        }
      : Authenticator.getAuth(resolvedAccount.username);

  launcher.on('debug', (data) => log({ ts: new Date().toISOString(), level: 'INFO', message: data }));
  launcher.on('data', (data) => logMinecraft({ ts: new Date().toISOString(), level: 'INFO', message: data }));
  launcher.on('progress', (data) => log({ ts: new Date().toISOString(), level: 'INFO', message: JSON.stringify(data) }));

  const launchOptions: any = {
    authorization: auth as any,
    root,
    version: {
      number: version,
      type: 'release'
    },
    javaPath,
    memory: {
      max: memoryMax,
      min: memoryMin
    },
    window: {
      width: settings.resolutionWidth,
      height: settings.resolutionHeight,
      fullscreen: settings.fullscreen
    }
  };

  if (config.modloader === 'forge') {
    launchOptions.forge = `forge-${version}-${config.modloaderVersion}`;
  }
  if (config.modloader === 'fabric') launchOptions.fabric = config.modloaderVersion;
  if (config.modloader === 'quilt') launchOptions.quilt = config.modloaderVersion;
  if (config.modloader === 'neoforge') launchOptions.neoforge = config.modloaderVersion;

  launcher
    .launch(launchOptions)
    .then(() => {
      log({ ts: new Date().toISOString(), level: 'INFO', message: 'Minecraft encerrado.' });
    })
    .catch((err) => {
      log({ ts: new Date().toISOString(), level: 'ERROR', message: `Falha ao iniciar: ${err}` });
    });

  await updateLastPlayed();
}
