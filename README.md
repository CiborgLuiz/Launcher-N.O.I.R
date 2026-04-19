# NOIR Launcher

Launcher desktop dedicado a um unico modpack de Minecraft Java Edition, com front React/Tailwind, shell desktop preparado para Tauri e fallback Electron funcional para desenvolvimento e validacao local.

## Estado atual

- `apps/desktop`: frontend React/Tailwind, desacoplado da shell via bridge desktop.
- `apps/desktop-electron`: shell Electron validável nesta máquina.
- `apps/desktop/src-tauri`: scaffold Tauri para a migração do shell quando houver toolchain Rust/Cargo.
- `packages/*`: auth Microsoft via `msmc`, runtime via `minecraft-launcher-core`, CurseForge, updater, instancia e tipos compartilhados.

## Requisitos

- Node.js 25+
- npm 11+
- Para Tauri: Rust/Cargo e toolchain do Tauri 2

## Desenvolvimento

### UI isolada

```bash
npm run dev:ui
```

### Shell Electron apontando para a UI em dev

Em um segundo terminal:

```bash
npm run dev:shell
```

### Build local

```bash
npm run build
```

### Pacote para validar o app empacotado

```bash
npm run pack
```

### Pacote Linux

```bash
npm run dist:linux
```

Isso gera um `AppImage` em `release/`.

### Instalador Windows com assistente de instalação

```bash
npm run dist:win
```

Isso gera o instalador `NSIS` em `release/` com assistente de instalação e usa o ícone `resources/branding/logo.ico` no app e no instalador.

Se quiser apenas um executável portátil sem instalador:

```bash
npm run dist:win:portable
```

Para gerar Linux e Windows em sequência:

```bash
npm run dist:all
```

### Testes

```bash
npm run test
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

- `MICROSOFT_CLIENT_ID` opcional
- `MS_REDIRECT_URI` opcional, mas obrigatorio se voce usar app Microsoft proprio
- `CURSEFORGE_API_KEY`
- `NOIR_ENABLE_DEV_OFFLINE=false` em produção

## Integracao base

- Login Microsoft: `msmc` faz o fluxo OAuth/Xbox/Minecraft e gera o payload `mclc()` usado no launch.
- Launch do jogo: `minecraft-launcher-core` e a fonte unica para download de assets, resolucao de bibliotecas, modloader e spawn do processo Java.
- Persistencia de sessao: o refresh token fica no vault local (`keytar` quando disponivel, fallback isolado em arquivo) e o launcher reidrata a sessao pelo `msmc`.

## Estrutura

```text
apps/
  desktop/              # frontend React + Tailwind + scaffold Tauri
  desktop-electron/     # shell Electron fallback
packages/
  auth/
  core/
  curseforge/
  instance-manager/
  launcher-runtime/
  shared/
  ui/
  updater/
resources/
  branding/
```

## Observações

- O shell Electron está funcional nesta base.
- O scaffold Tauri foi incluído, mas não foi validado nesta máquina porque não há `cargo`/`rustc` instalados.
- O modo offline existe apenas sob `NOIR_ENABLE_DEV_OFFLINE=true` e não deve ser exposto em builds de produção.
- O launcher empacotado procura overrides de ambiente em `~/.noirlauncher/.env`, ao lado do executável e em `resources/.env`, nessa ordem.
