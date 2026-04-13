# NOIR Launcher

Launcher desktop dedicado a um unico modpack de Minecraft Java Edition, com front React/Tailwind, shell desktop preparado para Tauri e fallback Electron funcional para desenvolvimento e validação local.

## Estado atual

- `apps/desktop`: frontend React/Tailwind, desacoplado da shell via bridge desktop.
- `apps/desktop-electron`: shell Electron validável nesta máquina.
- `apps/desktop/src-tauri`: scaffold Tauri para a migração do shell quando houver toolchain Rust/Cargo.
- `packages/*`: auth Microsoft, CurseForge, runtime Minecraft, updater, instância e tipos compartilhados.

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

### Testes

```bash
npm run test
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e configure:

- `MICROSOFT_CLIENT_ID`
- `MS_REDIRECT_URI`
- `CURSEFORGE_API_KEY`
- `NOIR_ENABLE_DEV_OFFLINE=false` em produção

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
