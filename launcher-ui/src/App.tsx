import React, { useEffect, useMemo, useState } from 'react';
import logoMark from './assets/logo-mark.png';
import logoFull from './assets/logo-full.png';

type Account =
  | { type: 'microsoft'; username: string; uuid: string; skin?: string }
  | { type: 'offline'; username: string; uuid: string; skin?: string };

type Settings = {
  ram: number;
  resolutionWidth: number;
  resolutionHeight: number;
  fullscreen: boolean;
  javaPath: string;
  autoUpdate: boolean;
};

type LogLine = { ts: string; level: string; message: string };

type Tab = 'play' | 'logs';

const isLoginWindow =
  new URLSearchParams(window.location.search).get('login') === '1' || window.location.hash === '#/login';

export default function App() {
  const [tab, setTab] = useState<Tab>('play');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [nickname, setNickname] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [progress, setProgress] = useState('');
  const [modpackVersion, setModpackVersion] = useState('');
  const [modpackFileName, setModpackFileName] = useState('');
  const [modpackReady, setModpackReady] = useState(false);
  const [launcherVersion, setLauncherVersion] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const refreshAccounts = async () => {
    const data = await window.noir.getAccounts();
    setAccounts(data);
    if (data.length > 0 && !selectedAccount) {
      setSelectedAccount(data[0].uuid);
    }
  };

  useEffect(() => {
    refreshAccounts();
    window.noir.getSettings().then(setSettings);
    window.noir.getLogs().then(setLogs);
    window.noir.getModpackStatus().then((s) => {
      if (s?.status) setProgress(s.status);
      if (s?.version) setModpackVersion(s.version);
      if (s?.fileName) setModpackFileName(s.fileName);
      if (typeof s?.ready === 'boolean') setModpackReady(s.ready);
    });
    window.noir.onModpackProgress((s) => {
      if (s?.status) setProgress(s.status);
      if (s?.version) setModpackVersion(s.version);
      if (s?.fileName) setModpackFileName(s.fileName);
      if (typeof s?.ready === 'boolean') setModpackReady(s.ready);
    });
    window.noir.onMinecraftStatus((s) => {
      if (s?.state === 'started') setProgress('Minecraft iniciado.');
      if (s?.state === 'error') setProgress(`Erro ao iniciar: ${s.message}`);
    });
    window.noir.getAppVersion().then(setLauncherVersion);

    const onFocus = () => refreshAccounts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((acc) => acc.uuid === selectedAccount) || accounts[0],
    [accounts, selectedAccount]
  );

  useEffect(() => {
    if (accounts.length && !selectedAccount) {
      setSelectedAccount(accounts[0].uuid);
    }
  }, [accounts, selectedAccount]);

  const onOfflineLogin = async () => {
    if (!nickname) return;
    await window.noir.loginOffline(nickname);
    await refreshAccounts();
    setNickname('');
    if (isLoginWindow) await window.noir.closeLoginWindow();
  };

  const onMicrosoftStart = async () => {
    setLoginLoading(true);
    setLoginError('');
    try {
      await window.noir.startMicrosoftLogin();
      await refreshAccounts();
      if (isLoginWindow) await window.noir.closeLoginWindow();
    } catch (err: any) {
      setLoginError(err?.message || 'Falha ao logar no Microsoft');
    } finally {
      setLoginLoading(false);
    }
  };

  const onPlay = async () => {
    if (!selectedAccount || !modpackReady) return;
    setProgress('Iniciando Minecraft...');
    await window.noir.play(selectedAccount);
  };

  const onSaveSettings = async () => {
    if (!settings) return;
    await window.noir.saveSettings(settings);
    setShowSettings(false);
  };

  const avatarUrl = activeAccount?.username
    ? `https://minotar.net/helm/${encodeURIComponent(activeAccount.username)}/64`
    : '';

  if (isLoginWindow) {
    return (
      <div className="min-h-screen noir-bg text-white">
        <div className="noir-particles" />
        <div className="noir-lines" />
        <div className="drag-region h-6" />
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-8">
          <img src={logoMark} alt="NOIR" className="h-24 w-24" />
          <div className="mt-4 text-2xl font-display">Conectar conta</div>
          <p className="mt-2 text-sm text-white/60">Login original Microsoft para o NOIR SMP.</p>

          <div className="mt-6 w-full max-w-sm space-y-3">
            <button
              onClick={onMicrosoftStart}
              disabled={loginLoading}
              className={`w-full rounded-xl px-4 py-3 ${
                loginLoading ? 'bg-white/10 text-white/40' : 'bg-[#c9a389] text-black'
              }`}
            >
              {loginLoading ? 'Aguardando login...' : 'Entrar com Microsoft'}
            </button>
          </div>
          {loginError && <div className="mt-3 text-xs text-red-300">{loginError}</div>}

          <div className="mt-6 w-full max-w-sm border-t border-white/10 pt-4">
            <div className="text-xs uppercase text-white/50">Offline</div>
            <div className="mt-3 flex gap-3">
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname"
                  className="flex-1 rounded-lg bg-white/10 px-3 py-2"
                />
                <button onClick={onOfflineLogin} className="rounded-lg bg-white/10 px-4 py-2">
                  Entrar
                </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen noir-bg text-white">
      <div className="noir-particles" />
      <div className="noir-lines" />

      <div className="relative z-10 flex min-h-screen flex-col px-8 py-8">
        <header className="drag-region flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoFull} alt="NOIR" className="h-10" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="no-drag rounded-full border border-white/10 bg-black/40 p-2 hover:border-white/30"
              aria-label="Configurações"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowAccountMenu((v) => !v)}
                className="no-drag flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="h-6 w-6 rounded-md" />
                ) : (
                  <div className="h-6 w-6 rounded-md bg-white/10" />
                )}
                <span className="text-xs uppercase tracking-[0.2em]">
                  {activeAccount?.username || 'SEM LOGIN'}
                </span>
              </button>
              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-black/80 p-2">
                  {accounts.map((acc) => (
                    <div
                      key={`${acc.type}-${acc.uuid}`}
                      className={`no-drag flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs ${
                        selectedAccount === acc.uuid ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedAccount(acc.uuid);
                          setShowAccountMenu(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <img
                          src={`https://minotar.net/helm/${encodeURIComponent(acc.username)}/24`}
                          alt="head"
                          className="h-5 w-5 rounded"
                        />
                        <span>{acc.username}</span>
                      </button>
                      <button
                        onClick={async () => {
                          await window.noir.removeAccount(acc.uuid);
                          await refreshAccounts();
                          setShowAccountMenu(false);
                        }}
                        className="rounded bg-white/10 px-2 py-1 text-[10px]"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      window.noir.openLoginWindow();
                      setShowAccountMenu(false);
                    }}
                    className="no-drag mt-2 w-full rounded-lg bg-white/10 px-3 py-2 text-xs"
                  >
                    Adicionar conta
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-8">
          <div className="flex flex-col items-center">
            <img src={logoMark} alt="NOIR" className="h-32 w-32" />
            <div className="mt-4 text-4xl font-display tracking-[0.4em]">NOIR SMP</div>
            <div className="mt-1 text-xs uppercase text-white/60">Núcleo de Operações e Investigações de Rupturas</div>
          </div>

          {tab === 'play' && (
            <div className="flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl border border-white/10 bg-black/60 p-8">
              <div className="w-full">
                <div className="text-xs uppercase text-white/50">Status</div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 animate-pulse bg-[#c9a389]" />
                </div>
                <div className="mt-2 text-xs text-white/70">{progress || 'Pronto para jogar'}</div>
                <div className="mt-1 text-xs text-white/40">Modpack: {modpackVersion || 'verificando...'}</div>
                {modpackFileName && (
                  <div className="mt-1 text-xs text-white/40">Arquivo: {modpackFileName}</div>
                )}
              </div>

              <button
                onClick={onPlay}
                disabled={!modpackReady}
                className={`noir-glow rounded-2xl px-16 py-4 text-lg font-display tracking-[0.2em] ${
                  modpackReady ? 'bg-[#c9a389] text-black' : 'bg-white/10 text-white/40'
                }`}
              >
                PLAY
              </button>
            </div>
          )}

          {tab === 'logs' && (
            <section className="w-full max-w-3xl rounded-2xl border border-white/10 bg-black/60 p-6">
              <div className="text-xs uppercase text-white/50">Logs</div>
              <div className="mt-4 max-h-[40vh] overflow-auto rounded-xl bg-black/40 p-4 text-xs">
                {logs.map((line, index) => (
                  <div key={index} className="text-white/70">
                    [{line.ts}] {line.level} - {line.message}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setTab('play')}
              className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                tab === 'play' ? 'bg-[#c9a389] text-black' : 'bg-white/10 text-white/70'
              }`}
            >
              Play
            </button>
            <button
              onClick={() => setTab('logs')}
              className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] ${
                tab === 'logs' ? 'bg-[#c9a389] text-black' : 'bg-white/10 text-white/70'
              }`}
            >
              Logs
            </button>
          </div>
        </main>

        <footer className="flex items-center justify-between text-xs text-white/40">
          <div>NOIR Launcher</div>
          <div>v{launcherVersion || '0.1.0'}</div>
        </footer>
      </div>

      {showSettings && settings && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-black/90 p-8">
            <div className="text-xs uppercase text-white/50">Configurações</div>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <label>
                <div className="text-xs uppercase text-white/50">RAM (MB)</div>
                <input
                  type="number"
                  value={settings.ram}
                  onChange={(e) => setSettings({ ...settings, ram: Number(e.target.value) })}
                  className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2"
                />
              </label>
              <label>
                <div className="text-xs uppercase text-white/50">Java Path</div>
                <input
                  value={settings.javaPath}
                  onChange={(e) => setSettings({ ...settings, javaPath: e.target.value })}
                  className="mt-2 w-full rounded-lg bg-white/10 px-3 py-2"
                />
              </label>
              <label>
                <div className="text-xs uppercase text-white/50">Resolução</div>
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    value={settings.resolutionWidth}
                    onChange={(e) =>
                      setSettings({ ...settings, resolutionWidth: Number(e.target.value) })
                    }
                    className="w-1/2 rounded-lg bg-white/10 px-3 py-2"
                  />
                  <input
                    type="number"
                    value={settings.resolutionHeight}
                    onChange={(e) =>
                      setSettings({ ...settings, resolutionHeight: Number(e.target.value) })
                    }
                    className="w-1/2 rounded-lg bg-white/10 px-3 py-2"
                  />
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.fullscreen}
                  onChange={(e) => setSettings({ ...settings, fullscreen: e.target.checked })}
                />
                <div className="text-xs uppercase text-white/50">Fullscreen</div>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={onSaveSettings} className="rounded-xl bg-[#c9a389] px-6 py-3 text-black">
                Salvar
              </button>
              <button onClick={() => setShowSettings(false)} className="rounded-xl bg-white/10 px-6 py-3">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
