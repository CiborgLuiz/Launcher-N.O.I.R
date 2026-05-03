import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import logoMark from "../../../resources/branding/logo2.png";
import wordmark from "../../../resources/branding/logolonga.png";
import type { LauncherLogEntry, LauncherSettings, LauncherSnapshot, LogCategory } from "@noir-shared/index";
import { Button, LogConsole, Panel, ProgressRail, StatusPill } from "@noir-ui/index";
import { getDesktopBridge } from "./lib/bridge";

const bridge = getDesktopBridge();
const LOG_TABS: Array<LogCategory | "all"> = ["all", "launcher", "auth", "install", "minecraft"];
const SCREENS = [
  { id: "play", label: "Inicio" },
  { id: "accounts", label: "Contas" },
  { id: "settings", label: "Ajustes" },
  { id: "logs", label: "Logs" }
] as const;

type ScreenId = (typeof SCREENS)[number]["id"];

type AccountAvatar = {
  avatarUrl?: string;
  username: string;
  uuid: string;
};

function buildAvatarCandidates(account: AccountAvatar, size: number): string[] {
  const encodedUuid = encodeURIComponent(account.uuid);
  const encodedUsername = encodeURIComponent(account.username);
  const urls = [
    account.avatarUrl && !/crafatar\.com/i.test(account.avatarUrl) ? account.avatarUrl : undefined,
    `https://mc-heads.net/avatar/${encodedUuid}/${size}`,
    `https://minotar.net/helm/${encodedUsername}/${size}`,
    account.avatarUrl,
    `https://crafatar.com/avatars/${encodedUuid}?size=${size}&overlay`
  ].filter((value): value is string => Boolean(value));

  return [...new Set(urls)];
}

function Avatar({
  account,
  size,
  className
}: {
  account?: AccountAvatar;
  size: number;
  className: string;
}) {
  const candidates = useMemo(() => (account ? buildAvatarCandidates(account, size) : []), [account, size]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFallback, setShowFallback] = useState(candidates.length === 0);

  useEffect(() => {
    setCurrentIndex(0);
    setShowFallback(candidates.length === 0);
  }, [candidates]);

  if (!account || showFallback || !candidates[currentIndex]) {
    return <div className={`${className} bg-[#080808]`} />;
  }

  return (
    <img
      src={candidates[currentIndex]}
      alt={account.username}
      className={className}
      onError={() => {
        setCurrentIndex((previousIndex) => {
          const nextIndex = previousIndex + 1;
          if (nextIndex >= candidates.length) {
            setShowFallback(true);
            return previousIndex;
          }
          return nextIndex;
        });
      }}
    />
  );
}

function formatDuration(durationMs?: number): string {
  if (!durationMs) {
    return "0m";
  }
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `${minutes}m`;
}

function formatPlaytimeHours(totalPlayedMs: number): string {
  if (!Number.isFinite(totalPlayedMs) || totalPlayedMs <= 0) {
    return "0,0 h";
  }

  const hours = totalPlayedMs / 3_600_000;
  const formatter = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: hours >= 10 ? 0 : 1,
    maximumFractionDigits: 1
  });
  return `${formatter.format(hours)} h`;
}

function hasPlayableInstall(snapshot: LauncherSnapshot): boolean {
  return Boolean(snapshot.instance.installedVersionLabel || snapshot.installState.installedFileId || snapshot.installState.lastSyncedAt);
}

function BootSplash({ ready }: { ready: boolean }) {
  return (
    <div className="noir-splash flex min-h-screen items-center justify-center overflow-hidden px-6 text-[#F7E8C3]">
      <div className="noir-splash-grid" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="noir-logo-orbit">
          <img src={logoMark} alt="NOIR" className="h-32 w-32 rounded-lg border border-[#C9A24E]/20 bg-[#050505] object-cover p-2 shadow-glow" />
        </div>
        <img src={wordmark} alt="NOIR Launcher" className="mt-8 h-16 w-auto max-w-[320px] object-contain" />
        <div className="mt-8 h-1 w-72 overflow-hidden rounded-full bg-[#1A160C]">
          <div className={`noir-loading-bar h-full rounded-full ${ready ? "w-full" : "w-2/3"}`} />
        </div>
        <div className="mt-5 text-[11px] uppercase tracking-[0.3em] text-[#C9A24E]">
          {ready ? "Interface pronta" : "Inicializando launcher"}
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<LauncherSnapshot | null>(null);
  const [logs, setLogs] = useState<LauncherLogEntry[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<LauncherSettings | null>(null);
  const [activeScreen, setActiveScreen] = useState<ScreenId>("play");
  const [activeLogCategory, setActiveLogCategory] = useState<LogCategory | "all">("all");
  const [offlineNickname, setOfflineNickname] = useState("");
  const [lastRunSummary, setLastRunSummary] = useState("Aguardando primeira execucao");
  const [updaterMessage, setUpdaterMessage] = useState("Sem updates pendentes");
  const [notice, setNotice] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "sync" | "login" | "save">("");
  const [launchRequested, setLaunchRequested] = useState(false);
  const [bootVisible, setBootVisible] = useState(true);
  const deferredLogs = useDeferredValue(logs);

  useEffect(() => {
    const timer = window.setTimeout(() => setBootVisible(false), 1350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [nextSnapshot, nextLogs] = await Promise.all([bridge.getSnapshot(), bridge.getLogs()]);
      if (!mounted) {
        return;
      }
      setSnapshot(nextSnapshot);
      setSettingsDraft(nextSnapshot.settings);
      setLogs(nextLogs);
    };

    void load();

    const unsubscribeSnapshot = bridge.onSnapshot((nextSnapshot) => {
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setSettingsDraft(nextSnapshot.settings);
      });
      if (nextSnapshot.installState.state !== "launching") {
        setLaunchRequested(false);
      }
    });

    const unsubscribeMinecraft = bridge.onMinecraftStatus((status) => {
      if (status.state === "started") {
        setNotice("Minecraft iniciado. Aguarde o carregamento da janela.");
      }
      if (status.state === "exited") {
        setLaunchRequested(false);
        setLastRunSummary(`Sessao encerrada em ${formatDuration(status.durationMs)}`);
        setNotice("Minecraft encerrado com sucesso.");
      }
      if (status.state === "error") {
        setLaunchRequested(false);
        setLastRunSummary(status.message);
        setNotice(status.message);
      }
    });

    const unsubscribeUpdater = bridge.onUpdaterStatus((status) => {
      setUpdaterMessage(status.message);
    });

    return () => {
      mounted = false;
      unsubscribeSnapshot();
      unsubscribeMinecraft();
      unsubscribeUpdater();
    };
  }, []);

  const activeAccount = useMemo(() => snapshot?.accounts[0], [snapshot]);
  const requiresLogin = Boolean(snapshot && snapshot.accounts.length === 0);
  const visibleScreen: ScreenId = activeScreen;
  const isInstallBusy = snapshot?.installState.state === "syncing";
  const isLaunching = Boolean(launchRequested || snapshot?.installState.state === "launching");
  const canPlay = Boolean(
    snapshot &&
      snapshot.accounts.length > 0 &&
      hasPlayableInstall(snapshot) &&
      !isInstallBusy &&
      !isLaunching
  );
  const playButtonLabel = isLaunching
    ? snapshot?.installState.currentStep === "running"
      ? "Minecraft aberto"
      : "Abrindo..."
    : "Play";

  const refreshLogs = async () => {
    const nextLogs = await bridge.getLogs();
    startTransition(() => {
      setLogs(nextLogs);
    });
  };

  const handleCopyLogs = async () => {
    const payload = deferredLogs
      .slice(-300)
      .map((entry) => JSON.stringify(entry))
      .join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      setNotice("Logs copiados.");
    } catch {
      setNotice("Nao foi possivel copiar os logs.");
    }
  };

  const runWithBusy = async (action: typeof busyAction, callback: () => Promise<void>) => {
    setBusyAction(action);
    setNotice("");
    try {
      await callback();
      await refreshLogs();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha na operacao");
    } finally {
      setBusyAction("");
    }
  };

  if (!snapshot || !settingsDraft || bootVisible) {
    return <BootSplash ready={Boolean(snapshot && settingsDraft)} />;
  }

  const requireLoginFirst = () => {
    if (!requiresLogin) {
      return false;
    }
    setNotice("Voce precisa logar primeiro.");
    return true;
  };

  const handleMicrosoftLogin = async () => {
    await runWithBusy("login", async () => {
      const nextSnapshot = await bridge.startMicrosoftLogin();
      setSnapshot(nextSnapshot);
      setNotice("Conta Microsoft conectada.");
    });
  };

  const handleOfflineLogin = async () => {
    const nickname = offlineNickname.trim();
    if (!nickname) {
      setNotice("Digite um nickname para continuar.");
      return;
    }

    await runWithBusy("login", async () => {
      const nextSnapshot = await bridge.loginOffline(nickname);
      setOfflineNickname("");
      setSnapshot(nextSnapshot);
      setNotice("Conta pirata adicionada.");
    });
  };

  const handlePlay = async () => {
    if (requireLoginFirst()) {
      return;
    }
    if (!activeAccount) {
      setNotice("Selecione uma conta para iniciar.");
      return;
    }
    if (isLaunching) {
      setNotice("O Minecraft ja esta abrindo ou em execucao.");
      return;
    }
    if (isInstallBusy) {
      setNotice("Aguarde a sincronizacao do modpack terminar.");
      return;
    }
    if (!hasPlayableInstall(snapshot)) {
      setNotice("Atualize o modpack antes de iniciar.");
      return;
    }

    setLaunchRequested(true);
    setNotice("Abrindo Minecraft...");

    try {
      await bridge.play(activeAccount.id);
      await refreshLogs();
    } catch (error) {
      setLaunchRequested(false);
      setNotice(error instanceof Error ? error.message : "Falha ao iniciar o Minecraft");
    }
  };

  const renderPlayScreen = () => (
    <div className="space-y-6">
      <Panel title="Visao Geral" subtitle="Status operacional da instancia NOIR.">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#B89A55]">Instancia dedicada</div>
            <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.18em] text-[#F7E8C3] md:text-5xl">
              {snapshot.config.modpackName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#CBB26B]">
              {snapshot.instance.serverAddress || snapshot.config.branding.tagline}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatusPill label="Launcher" value={`v${snapshot.launcherVersion}`} />
              <StatusPill label="Versao do pack" value={snapshot.instance.installedVersionLabel || "Aguardando sync"} />
              <StatusPill label="Java" value={`JDK ${snapshot.instance.javaVersionRequired}`} />
              <StatusPill label="Memoria" value={`${snapshot.settings.maximumRamMb} MB`} />
            </div>

            <div className="mt-6">
              <ProgressRail progress={snapshot.installState.progress} label={snapshot.installState.message} />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={() => void handlePlay()}
                disabled={!requiresLogin && !canPlay}
                className="min-w-[180px]"
              >
                {playButtonLabel}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (requireLoginFirst()) {
                    return;
                  }
                  void runWithBusy("sync", async () => {
                    const nextSnapshot = await bridge.syncModpack();
                    setSnapshot(nextSnapshot);
                  });
                }}
                disabled={busyAction === "sync"}
              >
                {busyAction === "sync" ? "Sincronizando" : "Atualizar modpack"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (requireLoginFirst()) {
                    return;
                  }
                  void bridge.openInstanceFolder();
                }}
              >
                Pasta da instancia
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (requireLoginFirst()) {
                    return;
                  }
                  void bridge.openLogsFolder();
                }}
              >
                Pasta de logs
              </Button>
            </div>

            {isLaunching && (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#B89A55]">
                {snapshot.installState.currentStep === "running"
                  ? "Minecraft em execucao. Aguarde o jogo fechar para abrir outra instancia."
                  : "O launcher esta preparando o Minecraft. Aguarde para evitar abrir duas vezes."}
              </p>
            )}
            {!isLaunching && snapshot.installState.state === "error" && hasPlayableInstall(snapshot) && (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#C7B182]">
                A ultima tentativa falhou, mas voce pode tentar abrir novamente.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[#C9A24E]/14 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Conta ativa</div>
              <div className="mt-4 flex items-center gap-4">
                {activeAccount ? (
                  <Avatar
                    account={activeAccount}
                    size={128}
                    className="h-16 w-16 rounded-lg border border-[#C9A24E]/20 object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-[#C9A24E]/16 bg-[#080808]" />
                )}
                <div>
                  <div className="text-lg font-semibold text-[#F7E8C3]">{activeAccount?.username || "Nenhuma conta selecionada"}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[#B89A55]">{activeAccount?.type || "Sem login"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#C9A24E]/14 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Status atual</div>
              <div className="mt-3 space-y-3">
                <StatusPill label="Launcher update" value={updaterMessage} tone="warning" />
                <StatusPill label="Ultima sessao" value={lastRunSummary} />
                <StatusPill label="Tempo jogado" value={formatPlaytimeHours(snapshot.installState.totalPlayedMs)} tone="success" />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderAccountsScreen = () => (
    <div className="space-y-6">
      <Panel
        title={requiresLogin ? "Entrar" : "Contas"}
        subtitle={
          requiresLogin
            ? "Acesso necessario para a instancia."
            : "Contas locais e sessao ativa."
        }
      >
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void handleMicrosoftLogin()} disabled={busyAction === "login"}>
            {busyAction === "login" ? "Aguardando..." : "Original"}
          </Button>
          <Button variant="secondary" onClick={() => setActiveScreen("play")} disabled={requiresLogin}>
            Voltar ao inicio
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {snapshot.accounts.length === 0 && (
              <div className="rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-5 py-6 text-[#B89A55]">
                Nenhuma conta salva ainda.
              </div>
            )}

            {snapshot.accounts.map((account, index) => (
              <div key={account.id} className="rounded-lg border border-[#C9A24E]/12 bg-[#111111] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {account ? (
                      <Avatar
                        account={account}
                        size={112}
                        className="h-14 w-14 rounded-lg border border-[#C9A24E]/18 object-cover"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg border border-[#C9A24E]/16 bg-[#080808]" />
                    )}
                    <div>
                      <div className="text-lg font-semibold text-[#F7E8C3]">{account.username}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[#B89A55]">{account.type}</div>
                      <div className="mt-2 text-xs text-[#CBB26B]">{account.uuid}</div>
                    </div>
                  </div>

                  {index === 0 && <span className="rounded-full bg-[#C9A24E]/12 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#E8CB83]">Ativa</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const nextSnapshot = await bridge.selectAccount(account.id);
                      setSnapshot(nextSnapshot);
                      setNotice(`Conta ativa alterada para ${account.username}.`);
                    }}
                  >
                    Ativar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      const nextSnapshot = await bridge.removeAccount(account.id);
                      setSnapshot(nextSnapshot);
                      setNotice(`Conta ${account.username} removida.`);
                    }}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-[#C9A24E]/12 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Original</div>
              <p className="mt-3 text-sm leading-7 text-[#CBB26B]">Sessao oficial Microsoft.</p>
            </div>

            <div className="rounded-lg border border-[#C9A24E]/16 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Pirata</div>
              <p className="mt-3 text-sm leading-7 text-[#CBB26B]">Perfil offline local.</p>
              <div className="mt-4 flex gap-3">
                <input
                  value={offlineNickname}
                  onChange={(event) => setOfflineNickname(event.target.value)}
                  placeholder="Digite seu nickname"
                  className="flex-1 rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-sm text-[#F7E8C3] outline-none placeholder:text-[#8A7135]"
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleOfflineLogin()}
                  disabled={!offlineNickname.trim() || busyAction === "login"}
                >
                  Pirata
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderSettingsScreen = () => (
    <div className="space-y-6">
      <Panel title="Ajustes" subtitle="Memoria, resolucao, Java e updates.">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">RAM minima</span>
            <input
              type="number"
              value={settingsDraft.minimumRamMb}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, minimumRamMb: Number(event.target.value) })}
              className="w-full rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-[#F7E8C3]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">RAM maxima</span>
            <input
              type="number"
              value={settingsDraft.maximumRamMb}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, maximumRamMb: Number(event.target.value) })}
              className="w-full rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-[#F7E8C3]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Largura</span>
            <input
              type="number"
              value={settingsDraft.resolutionWidth}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, resolutionWidth: Number(event.target.value) })}
              className="w-full rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-[#F7E8C3]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Altura</span>
            <input
              type="number"
              value={settingsDraft.resolutionHeight}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, resolutionHeight: Number(event.target.value) })}
              className="w-full rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-[#F7E8C3]"
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Java manual</span>
            <input
              value={settingsDraft.javaPath}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, javaPath: event.target.value })}
              placeholder="Opcional"
              className="w-full rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-[#F7E8C3] placeholder:text-[#8A7135]"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-4 py-3 text-[#F7E8C3]">
            <span>Fullscreen</span>
            <input
              type="checkbox"
              checked={settingsDraft.fullscreen}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, fullscreen: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-4 py-3 text-[#F7E8C3]">
            <span>Minimizar o launcher quando o jogo abrir</span>
            <input
              type="checkbox"
              checked={settingsDraft.minimizeOnGameLaunch}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, minimizeOnGameLaunch: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-4 py-3 text-[#F7E8C3]">
            <span>Auto update do launcher</span>
            <input
              type="checkbox"
              checked={settingsDraft.autoUpdateLauncher}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, autoUpdateLauncher: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-4 py-3 text-[#F7E8C3]">
            <span>Auto update do modpack</span>
            <input
              type="checkbox"
              checked={settingsDraft.autoUpdateModpack}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, autoUpdateModpack: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[#111111] px-4 py-3 text-[#F7E8C3]">
            <span>Telemetria</span>
            <input
              type="checkbox"
              checked={settingsDraft.telemetryEnabled}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, telemetryEnabled: event.target.checked })}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            onClick={() =>
              runWithBusy("save", async () => {
                const nextSnapshot = await bridge.saveSettings(settingsDraft);
                setSnapshot(nextSnapshot);
                setNotice("Configuracoes salvas.");
              })
            }
            disabled={busyAction === "save"}
          >
            {busyAction === "save" ? "Salvando..." : "Salvar ajustes"}
          </Button>
          <Button variant="secondary" onClick={() => setActiveScreen("play")}>
            Voltar ao inicio
          </Button>
        </div>
      </Panel>
    </div>
  );

  const renderLogsScreen = () => (
    <div className="space-y-6">
      <Panel title="Logs" subtitle="Eventos recentes por categoria.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {LOG_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLogCategory(tab)}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                  activeLogCategory === tab
                    ? "bg-[#C9A24E] text-[#090806]"
                    : "border border-[#C9A24E]/16 bg-[#111111] text-[#CBB26B] hover:border-[#C9A24E]/34"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={refreshLogs}>
              Recarregar
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCopyLogs()}
            >
              Copiar
            </Button>
          </div>
        </div>
        <LogConsole entries={deferredLogs} category={activeLogCategory} />
      </Panel>
    </div>
  );

  const renderLoginModal = () => {
    if (!requiresLogin) {
      return null;
    }

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[rgba(5,4,2,0.82)] px-5 py-6 backdrop-blur-md">
        <div className="w-full max-w-4xl rounded-lg border border-[#C9A24E]/20 bg-[linear-gradient(180deg,rgba(24,19,14,0.98),rgba(12,9,6,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)] md:p-8">
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#B89A55]">Acesso obrigatorio</div>
          <h2 className="mt-4 font-display text-3xl uppercase tracking-[0.16em] text-[#F7E8C3] md:text-4xl">
            Voce precisa logar primeiro
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#CBB26B]">Acesso necessario para perfis, modpack e runtime.</p>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[#C9A24E]/14 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Original</div>
              <p className="mt-3 text-sm leading-7 text-[#CBB26B]">Conta Microsoft oficial.</p>
              <Button onClick={() => void handleMicrosoftLogin()} disabled={busyAction === "login"} className="mt-5 min-w-[180px]">
                {busyAction === "login" ? "Aguardando..." : "Entrar com Microsoft"}
              </Button>
            </div>

            <div className="rounded-lg border border-[#C9A24E]/14 bg-[#111111] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B89A55]">Pirata</div>
              <p className="mt-3 text-sm leading-7 text-[#CBB26B]">Perfil offline local.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  value={offlineNickname}
                  onChange={(event) => setOfflineNickname(event.target.value)}
                  placeholder="Digite seu nickname"
                  className="flex-1 rounded-lg border border-[#C9A24E]/14 bg-[#080808] px-4 py-3 text-sm text-[#F7E8C3] outline-none placeholder:text-[#8A7135]"
                />
                <Button variant="secondary" onClick={() => void handleOfflineLogin()} disabled={!offlineNickname.trim() || busyAction === "login"}>
                  Entrar offline
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderScreen = () => {
    switch (visibleScreen) {
      case "accounts":
        return renderAccountsScreen();
      case "settings":
        return renderSettingsScreen();
      case "logs":
        return renderLogsScreen();
      case "play":
      default:
        return renderPlayScreen();
    }
  };

  return (
    <div className="noir-app-shell relative min-h-screen overflow-hidden text-[#F7E8C3]">
      <div className="noir-stage absolute inset-0" />
      <div className="absolute inset-0 bg-noir-grid bg-[size:48px_48px] opacity-[0.07]" />
      <div className="noir-scanline absolute inset-0" />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 md:px-8 md:py-7">
        <header className="drag-region mx-auto flex w-full max-w-[1440px] items-center justify-between rounded-lg border border-[#C9A24E]/12 bg-[rgba(8,8,8,0.82)] px-5 py-4 shadow-card backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <img src={logoMark} alt="NOIR" className="h-14 w-14 rounded-lg border border-[#C9A24E]/14 bg-[#0E0B08] object-cover p-1" />
            <div>
              <img src={wordmark} alt="NOIR Launcher" className="h-10 w-auto max-w-[240px] object-contain" />
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#B89A55]">{snapshot.config.branding.tagline}</p>
            </div>
          </div>

          <div className="no-drag flex items-center gap-2">
            <Button variant="ghost" onClick={() => bridge.minimizeWindow()} className="px-3 py-2 tracking-[0.28em]">
              _
            </Button>
            <Button variant="ghost" onClick={() => bridge.closeWindow()} className="px-3 py-2 tracking-[0.28em]">
              X
            </Button>
          </div>
        </header>

        <main className="relative mx-auto mt-6 grid w-full max-w-[1440px] flex-1 gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Panel className="p-5">
              <div className="flex items-center gap-4">
                <img src={logoMark} alt="NOIR" className="h-16 w-16 rounded-lg border border-[#C9A24E]/16 object-cover p-1" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#B89A55]">Launcher</div>
                  <div className="mt-2 text-xl font-semibold text-[#F7E8C3]">{snapshot.config.branding.productName}</div>
                </div>
              </div>

              <nav className="mt-6 grid gap-2">
                {SCREENS.map((screen) => (
                  <button
                    key={screen.id}
                    onClick={() => {
                      if (requiresLogin && screen.id !== "accounts") {
                        setNotice("Voce precisa logar primeiro.");
                        return;
                      }
                      setActiveScreen(screen.id);
                    }}
                    className={`rounded-lg px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.24em] transition ${
                      visibleScreen === screen.id
                        ? "bg-[linear-gradient(135deg,#E8C472_0%,#B98A35_52%,#6B521F_100%)] text-[#090709] shadow-glow"
                        : "border border-[#C9A24E]/12 bg-[#0C0C0C] text-[#CBB26B] hover:border-[#C9A24E]/30 hover:bg-[#19150B]"
                    }`}
                  >
                    {screen.label}
                  </button>
                ))}
              </nav>
            </Panel>

            <Panel className="p-5">
              <div className="grid gap-3">
                <StatusPill label="Estado" value={snapshot.installState.state} tone={snapshot.installState.state === "error" ? "danger" : "warning"} />
                <StatusPill label="Mod loader" value={`${snapshot.instance.modLoader} ${snapshot.instance.modLoaderVersion}`} />
                <StatusPill label="Conta" value={activeAccount?.username || "Sem login"} />
              </div>
            </Panel>
          </aside>

          <section className="min-w-0 space-y-4">
            {notice && (
              <div className="animate-panel-in rounded-lg border border-[#C9A24E]/18 bg-[#0C0C0C] px-4 py-4 text-sm text-[#E8CB83] shadow-card">
                {notice}
              </div>
            )}
            {renderScreen()}
          </section>

          {renderLoginModal()}
        </main>
      </div>
    </div>
  );
}
