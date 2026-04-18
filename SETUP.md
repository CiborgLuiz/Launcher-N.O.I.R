# Setup

## 1. Microsoft login

O launcher agora usa `msmc` como camada oficial de autenticacao Microsoft recomendada pelo `minecraft-launcher-core`.

### Fluxo padrao

- Se `MICROSOFT_CLIENT_ID` ficar vazio, o launcher usa o token padrao suportado pelo `msmc`.
- Nesse modo, basta manter o callback local do launcher configurado em `MS_REDIRECT_URI` ou nas variaveis de host/porta.

### App proprio no Microsoft Entra

1. Abra o portal Microsoft Entra.
2. Crie um novo app registration para o launcher.
3. Em `Authentication`, habilite `Allow public client flows`.
4. Adicione o redirect URI desktop/local usado pelo launcher, por exemplo `http://127.0.0.1:53682/callback`.
5. Copie o `Application (client) ID`.
6. Grave esse valor em `.env` como `MICROSOFT_CLIENT_ID`.

## 2. Redirect URI

- O launcher espera `MS_REDIRECT_URI` completo.
- Se preferir montar por partes, use `MS_REDIRECT_HOST` e `MS_REDIRECT_PORT`.
- Se `MICROSOFT_CLIENT_ID` estiver configurado, o valor cadastrado no Entra precisa bater exatamente com o callback local usado na shell.

## 3. CurseForge

1. Gere uma API key no painel do CurseForge.
2. Salve em `.env` como `CURSEFORGE_API_KEY`.
3. Descubra o `Project ID` do modpack na URL/painel do projeto.
4. Se quiser fixar um arquivo específico, use `preferredFileId` em `launcher.config.json`.

## 4. launcher.config.json

Campos principais:

- `modpackName`
- `curseforgeProjectId`
- `preferredFileId`
- `minecraftVersion`
- `modLoader`
- `modLoaderVersion`
- `minimumRamMb`
- `recommendedRamMb`
- `javaVersionRequired`
- `serverAddress`
- `branding`

## 5. Updater

### Electron

- O código usa `electron-updater`.
- Para produção, publique releases assinadas e um feed compatível.
- Em ambiente de dev/local, o updater deve ser tratado como opcional.

### Tauri

- O scaffold está em `apps/desktop/src-tauri`.
- Quando a toolchain estiver disponível, escolha o plugin/updater Tauri compatível com o canal de releases.

## 6. Build Windows e Linux

### Electron fallback

1. Rode `npm run build`.
2. Empacote com a estratégia de distribuição que preferir.
3. Configure assinatura e auto-update conforme o canal de release.

### Tauri target

1. Instale Rust/Cargo.
2. Instale os pré-requisitos do Tauri 2.
3. Valide `apps/desktop/src-tauri/tauri.conf.json`.
4. Gere os bundles nativos quando a integração Tauri for fechada.

## 7. Branding

- Os SVGs base estão em `resources/branding`.
- Substitua `noir-logo-mark.svg` e `noir-logo-wordmark.svg` para trocar identidade visual.
- Ajuste também `branding` em `launcher.config.json`.

## 8. Segurança

- Não comite `.env`.
- Nao hardcodeie `MICROSOFT_CLIENT_ID` ou `CURSEFORGE_API_KEY`.
- Mantenha `NOIR_ENABLE_DEV_OFFLINE=false` fora de ambiente local.
