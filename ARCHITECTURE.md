# Architecture

## Objetivo

O launcher foi organizado para servir um unico modpack, com UI desacoplada da shell e regras de negócio isoladas em pacotes reutilizáveis.

## Camadas

### `apps/desktop`

- UI React/Tailwind.
- Consome uma `DesktopBridge` única.
- Não depende de Electron diretamente.
- Está pronta para falar com Electron hoje e Tauri depois.

### `apps/desktop-electron`

- Shell desktop funcional nesta base.
- Responsavel por janela, IPC, callback local do OAuth e abertura de pastas.
- Encapsula atualizações, eventos de progresso e boot do serviço principal.

### `apps/desktop/src-tauri`

- Scaffold do shell Tauri.
- Mantido separado porque a máquina atual não possui Rust/Cargo.
- A bridge do frontend já foi pensada para permitir essa troca sem reescrever a UI.

## Pacotes

### `packages/shared`

- Tipos comuns.
- Parsers/validators de config, settings, metadata, logs e lockfile.

### `packages/instance-manager`

- Layout de diretórios em `~/.noirlauncher`.
- Criação de links entre `game/` e diretórios persistentes como `mods/`, `config/`, `logs/`.
- Leitura/escrita de `settings.json`, `metadata/instance.json`, `metadata/modpack-lock.json` e `metadata/install-state.json`.

### `packages/auth`

- Fluxo Microsoft via `msmc`, incluindo OAuth, Xbox Live, XSTS e Minecraft Services/Profile.
- Armazenamento de refresh token via keychain quando possível, com fallback local isolado.
- Conta offline bloqueada por flag de desenvolvimento.

### `packages/curseforge`

- Cliente oficial em `https://api.curseforge.com`.
- Resolução do arquivo-alvo do projeto.
- Download com cache, retry e verificação de hash quando disponível.

### `packages/launcher-runtime`

- Planejamento de update incremental do modpack.
- Extração de overrides com preservação de diretórios do usuário.
- Gerenciamento de Java local via Temurin.
- Launch do Minecraft com `minecraft-launcher-core`, usando o payload `mclc()` gerado pelo `msmc`.

### `packages/core`

- Serviço de aplicação `NoirLauncherService`.
- Logger estruturado por canais.
- Orquestra sync, contas, settings, runtime e emissão de snapshot.

### `packages/updater`

- Adapter do `electron-updater`.
- Emite estado de update para a shell/UI.

## Fluxo principal

1. Shell sobe o `NoirLauncherService`.
2. Serviço garante layout local, lê config e settings.
3. UI recebe um snapshot único.
4. Sync do modpack resolve a versão no CurseForge, baixa apenas o necessário e atualiza o lockfile.
5. Play resolve a conta, garante Java e entrega o launch ao `minecraft-launcher-core`.
6. Logs estruturados alimentam a aba de observabilidade.

## Persistência

```text
~/.noirlauncher/
  noir-smp/
    game/
    mods/
    config/
    resourcepacks/
    shaderpacks/
    saves/
    logs/
    libraries/
    assets/
    runtime/
    natives/
    metadata/
      instance.json
      modpack-lock.json
      install-state.json
  cache/
  accounts/
    accounts.json
  settings.json
  launcher.log
  auth.log
  install.log
```

## Limitações atuais

- O shell Tauri não foi validado nesta máquina.
- O frontend usa bridge própria em vez de bindings Tauri/Electron diretos para preservar a migração.
- A política de preservação de overrides prioriza arquivos do usuário em `config/`, `resourcepacks/`, `shaderpacks/` e `saves/`.
