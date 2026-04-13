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

function formatDuration(durationMs?: number): string {
  if (!durationMs) {
    return "0m";
  }
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `${minutes}m`;
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
  const [busyAction, setBusyAction] = useState<"" | "sync" | "play" | "login" | "save">("");
  const deferredLogs = useDeferredValue(logs);

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
    });

    const unsubscribeMinecraft = bridge.onMinecraftStatus((status) => {
      if (status.state === "started") {
        setNotice("Minecraft iniciado.");
      }
      if (status.state === "exited") {
        setLastRunSummary(`Sessao encerrada em ${formatDuration(status.durationMs)}`);
        setNotice("Minecraft encerrado com sucesso.");
      }
      if (status.state === "error") {
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
  const canPlay = Boolean(snapshot && snapshot.accounts.length > 0 && snapshot.installState.state === "ready");

  const refreshLogs = async () => {
    const nextLogs = await bridge.getLogs();
    startTransition(() => {
      setLogs(nextLogs);
    });
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

  if (!snapshot || !settingsDraft) {
    return <div className="flex min-h-screen items-center justify-center text-[#C7B182]">Carregando launcher...</div>;
  }

  const renderPlayScreen = () => (
    <div className="space-y-6">
      <Panel title="Visao Geral" subtitle="Launcher dedicado a um unico modpack, com atualizacao incremental, login Microsoft oficial e runtime local.">
        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[#B49A66]">Instancia dedicada</div>
            <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.18em] text-[#F6F0E1] md:text-5xl">
              {snapshot.config.modpackName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#D5C39A]">
              Tudo foi organizado para um fluxo direto: verificar launcher, verificar modpack, confirmar conta, revisar status e iniciar o jogo.
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
                onClick={() =>
                  runWithBusy("play", async () => {
                    if (activeAccount) {
                      await bridge.play(activeAccount.id);
                    }
                  })
                }
                disabled={!canPlay || busyAction === "play"}
                className="min-w-[180px]"
              >
                {busyAction === "play" ? "Abrindo..." : "Play"}
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  runWithBusy("sync", async () => {
                    const nextSnapshot = await bridge.syncModpack();
                    setSnapshot(nextSnapshot);
                  })
                }
                disabled={busyAction === "sync"}
              >
                {busyAction === "sync" ? "Sincronizando" : "Atualizar modpack"}
              </Button>
              <Button variant="secondary" onClick={() => bridge.openInstanceFolder()}>
                Pasta da instancia
              </Button>
              <Button variant="secondary" onClick={() => bridge.openLogsFolder()}>
                Pasta de logs
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[26px] border border-[#C7A24A]/14 bg-[#18130E] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Conta ativa</div>
              <div className="mt-4 flex items-center gap-4">
                {activeAccount?.avatarUrl ? (
                  <img src={activeAccount.avatarUrl} alt={activeAccount.username} className="h-16 w-16 rounded-2xl border border-[#C7A24A]/20 object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-2xl border border-[#C7A24A]/16 bg-[#100D09]" />
                )}
                <div>
                  <div className="text-lg font-semibold text-[#F6F0E1]">{activeAccount?.username || "Nenhuma conta selecionada"}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[#B49A66]">{activeAccount?.type || "Sem login"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#C7A24A]/14 bg-[#18130E] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Status atual</div>
              <div className="mt-3 space-y-3">
                <StatusPill label="Launcher update" value={updaterMessage} tone="warning" />
                <StatusPill label="Ultima sessao" value={lastRunSummary} />
                <StatusPill
                  label="Servidor"
                  value={snapshot.instance.serverAddress || "Nao configurado"}
                  tone={snapshot.instance.serverAddress ? "success" : "default"}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderAccountsScreen = () => (
    <div className="space-y-6">
      <Panel title="Contas" subtitle="Use somente login Microsoft oficial. Para desenvolvimento local, o modo offline continua restrito por flag de build.">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() =>
              runWithBusy("login", async () => {
                const nextSnapshot = await bridge.startMicrosoftLogin();
                setSnapshot(nextSnapshot);
                setNotice("Fluxo Microsoft iniciado no navegador padrao.");
              })
            }
            disabled={busyAction === "login"}
          >
            {busyAction === "login" ? "Aguardando..." : "Entrar com Microsoft"}
          </Button>
          <Button variant="secondary" onClick={() => setActiveScreen("play")}>
            Voltar ao inicio
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {snapshot.accounts.length === 0 && (
              <div className="rounded-[24px] border border-[#C7A24A]/12 bg-[#18130E] px-5 py-6 text-[#B49A66]">
                Nenhuma conta salva ainda.
              </div>
            )}

            {snapshot.accounts.map((account, index) => (
              <div key={account.id} className="rounded-[24px] border border-[#C7A24A]/12 bg-[#18130E] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {account.avatarUrl ? (
                      <img src={account.avatarUrl} alt={account.username} className="h-14 w-14 rounded-2xl border border-[#C7A24A]/18 object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl border border-[#C7A24A]/16 bg-[#100D09]" />
                    )}
                    <div>
                      <div className="text-lg font-semibold text-[#F6F0E1]">{account.username}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.22em] text-[#B49A66]">{account.type}</div>
                      <div className="mt-2 text-xs text-[#D5C39A]">{account.uuid}</div>
                    </div>
                  </div>

                  {index === 0 && <span className="rounded-full bg-[#C7A24A]/12 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-[#E9D8A6]">Ativa</span>}
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
            <div className="rounded-[24px] border border-[#C7A24A]/12 bg-[#18130E] p-5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Login oficial</div>
              <p className="mt-3 text-sm leading-7 text-[#D5C39A]">
                O launcher agora abre o fluxo Microsoft no navegador padrao do sistema, em vez de depender de uma janela embutida. Isso tende a ser mais estavel para recuperar o perfil corretamente.
              </p>
            </div>

            {snapshot.devOfflineAvailable && (
              <div className="rounded-[24px] border border-[#C7A24A]/16 bg-[#18130E] p-5">
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Offline dev only</div>
                <p className="mt-3 text-sm leading-7 text-[#D5C39A]">
                  Uso apenas para validar UI e instancia em desenvolvimento local. Nao serve como substituto do login oficial.
                </p>
                <div className="mt-4 flex gap-3">
                  <input
                    value={offlineNickname}
                    onChange={(event) => setOfflineNickname(event.target.value)}
                    placeholder="Nickname de teste"
                    className="flex-1 rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-sm text-[#F6F0E1] outline-none placeholder:text-[#7F6D48]"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      runWithBusy("login", async () => {
                        const nextSnapshot = await bridge.loginOffline(offlineNickname);
                        setOfflineNickname("");
                        setSnapshot(nextSnapshot);
                        setNotice("Conta offline de desenvolvimento criada.");
                      })
                    }
                    disabled={!offlineNickname.trim()}
                  >
                    Entrar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );

  const renderSettingsScreen = () => (
    <div className="space-y-6">
      <Panel title="Ajustes" subtitle="Controle memoria, resolucao, Java e politicas de update do launcher.">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">RAM minima</span>
            <input
              type="number"
              value={settingsDraft.minimumRamMb}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, minimumRamMb: Number(event.target.value) })}
              className="w-full rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-[#F6F0E1]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">RAM maxima</span>
            <input
              type="number"
              value={settingsDraft.maximumRamMb}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, maximumRamMb: Number(event.target.value) })}
              className="w-full rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-[#F6F0E1]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Largura</span>
            <input
              type="number"
              value={settingsDraft.resolutionWidth}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, resolutionWidth: Number(event.target.value) })}
              className="w-full rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-[#F6F0E1]"
            />
          </label>
          <label className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Altura</span>
            <input
              type="number"
              value={settingsDraft.resolutionHeight}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, resolutionHeight: Number(event.target.value) })}
              className="w-full rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-[#F6F0E1]"
            />
          </label>
          <label className="space-y-2 lg:col-span-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#B49A66]">Java manual</span>
            <input
              value={settingsDraft.javaPath}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, javaPath: event.target.value })}
              placeholder="Opcional"
              className="w-full rounded-2xl border border-[#C7A24A]/14 bg-[#100D09] px-4 py-3 text-[#F6F0E1] placeholder:text-[#7F6D48]"
            />
          </label>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <label className="flex items-center justify-between rounded-2xl border border-[#C7A24A]/12 bg-[#18130E] px-4 py-3 text-[#F6F0E1]">
            <span>Fullscreen</span>
            <input
              type="checkbox"
              checked={settingsDraft.fullscreen}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, fullscreen: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[#C7A24A]/12 bg-[#18130E] px-4 py-3 text-[#F6F0E1]">
            <span>Auto update do launcher</span>
            <input
              type="checkbox"
              checked={settingsDraft.autoUpdateLauncher}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, autoUpdateLauncher: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[#C7A24A]/12 bg-[#18130E] px-4 py-3 text-[#F6F0E1]">
            <span>Auto update do modpack</span>
            <input
              type="checkbox"
              checked={settingsDraft.autoUpdateModpack}
              onChange={(event) => setSettingsDraft({ ...settingsDraft, autoUpdateModpack: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border border-[#C7A24A]/12 bg-[#18130E] px-4 py-3 text-[#F6F0E1]">
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
      <Panel title="Logs" subtitle="Observabilidade por categoria para launcher, autenticacao, instalacao e runtime do Minecraft.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {LOG_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveLogCategory(tab)}
                className={`rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em] transition ${
                  activeLogCategory === tab
                    ? "bg-[#C7A24A] text-[#090806]"
                    : "border border-[#C7A24A]/16 bg-[#18130E] text-[#D5C39A] hover:border-[#C7A24A]/34"
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
              onClick={() => navigator.clipboard.writeText(deferredLogs.map((entry) => JSON.stringify(entry)).join("\n"))}
            >
              Copiar
            </Button>
          </div>
        </div>
        <LogConsole entries={deferredLogs} category={activeLogCategory} />
      </Panel>
    </div>
  );

  const renderScreen = () => {
    switch (activeScreen) {
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
    <div className="relative min-h-screen overflow-hidden text-[#F6F0E1]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(199,162,74,0.18),transparent_26%),linear-gradient(180deg,#0E0B08_0%,#090806_48%,#050402_100%)]" />
      <div className="absolute inset-0 bg-noir-grid bg-[size:48px_48px] opacity-[0.08]" />

      <div className="relative z-10 flex min-h-screen flex-col px-5 py-5 md:px-8 md:py-7">
        <header className="drag-region flex items-center justify-between rounded-[28px] border border-[#C7A24A]/12 bg-[rgba(16,13,9,0.78)] px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <img src={logoMark} alt="NOIR" className="h-14 w-14 rounded-2xl border border-[#C7A24A]/14 bg-[#0E0B08] object-cover p-1" />
            <div>
              <img src={wordmark} alt="NOIR Launcher" className="h-10 w-auto max-w-[240px] object-contain" />
              <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-[#B49A66]">{snapshot.config.branding.tagline}</p>
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

        <main className="mt-6 grid flex-1 gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Panel className="p-5">
              <div className="flex items-center gap-4">
                <img src={logoMark} alt="NOIR" className="h-16 w-16 rounded-2xl border border-[#C7A24A]/16 object-cover p-1" />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.24em] text-[#B49A66]">Launcher</div>
                  <div className="mt-2 text-xl font-semibold text-[#F6F0E1]">{snapshot.config.branding.productName}</div>
                </div>
              </div>

              <nav className="mt-6 grid gap-2">
                {SCREENS.map((screen) => (
                  <button
                    key={screen.id}
                    onClick={() => setActiveScreen(screen.id)}
                    className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.24em] transition ${
                      activeScreen === screen.id
                        ? "bg-[linear-gradient(135deg,rgba(199,162,74,1),rgba(142,106,34,0.96))] text-[#090806]"
                        : "border border-[#C7A24A]/12 bg-[#16110B] text-[#D5C39A] hover:border-[#C7A24A]/26"
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
              <div className="rounded-[22px] border border-[#C7A24A]/18 bg-[#16110B] px-4 py-4 text-sm text-[#E9D8A6]">
                {notice}
              </div>
            )}
            {renderScreen()}
          </section>
        </main>
      </div>
    </div>
  );
}
