# Login e cadastro de produto pelo celular — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir login, acesso ao painel e cadastro de produto com foto pelo celular, com erros de upload claros.

**Architecture:** O servidor aceita fotos de até 20 MB, aplica a orientação EXIF e responde 413 em português. No front, uma função pura monta a mensagem de erro do upload (tamanho, 413 do Nginx, rede), e o `product-form` a usa. A navbar mostra o botão de conta no celular e ganha "Minha conta" e "Painel Admin" no menu do celular.

**Tech Stack:** Express 5, multer, sharp, Vitest + Supertest; Angular 21, Tailwind 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-admin-pelo-celular-design.md`

## Global Constraints

- Limite de upload: 20 MB (`20 * 1024 * 1024` bytes), o mesmo valor no servidor e no front.
- Mensagens em português, exatamente como no spec.
- Nenhuma dependência nova.

## Review Focus

- Foto exatamente em 20 MB é aceita; 1 byte a mais é recusada (teste nos dois lados).
- Resposta 413 com corpo HTML do Nginx (sem `error` em JSON) → mensagem do Nginx, não "Erro 413".
- Envio de várias fotos extras em que a segunda falha: a primeira continua na lista e o aviso cita o nome do arquivo da segunda.
- Painel de login no celular de 390px não vaza para fora da tela.
- Status 0 (sem internet) → mensagem de rede.

---

### Task 1: Upload no servidor (20 MB, orientação, 413)

**Files:**
- Modify: `server/routes/upload.ts`
- Test: `server/routes/upload.test.ts` (novo)

**Interfaces:**
- Produces: `export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024` e as respostas `413 { error: 'A foto tem mais de 20 MB. Tire a foto em resolução menor ou escolha outra imagem.' }` e `400 { error: 'Envie apenas arquivos de imagem.' }`.

- [ ] **Step 1:** Testes (Supertest, permissões mockadas como nas outras rotas, `UPLOADS_DIR` apontando para uma pasta temporária):
  - `aceita imagem e salva JPG` → 201 com `url` iniciando por `/uploads/`.
  - `respeita a orientação EXIF` → imagem 20x10 com `withMetadata({ orientation: 6 })`; o arquivo salvo tem 10x20.
  - `recusa acima de 20 MB com 413 e mensagem em português`.
  - `recusa arquivo que não é imagem com 400`.
- [ ] **Step 2:** Rodar `npx vitest run server/routes/upload.test.ts` → falham (limite, orientação, 413).
- [ ] **Step 3:** Implementar: `fileSize: MAX_UPLOAD_BYTES`; chamar `upload.single('image')` dentro de um handler que traduz `MulterError` `LIMIT_FILE_SIZE` → 413 e o erro do `fileFilter` → 400; `sharp(buf).rotate().resize(...)`.
- [ ] **Step 4:** Rodar de novo → passam. Rodar `npm test` e `npm run typecheck`.
- [ ] **Step 5:** Commit `feat(server): upload de foto do celular até 20 MB, com orientação e erro 413 claro`.

### Task 2: Mensagem de erro do upload no front

**Files:**
- Create: `client/src/app/utils/upload-error.ts`
- Test: `client/src/app/utils/upload-error.spec.ts`
- Modify: `client/src/app/components/admin/product-form/product-form.ts` (`handleFileChange`, `handleExtraFilesChange`)

**Interfaces:**
- Produces:
  - `MAX_UPLOAD_BYTES = 20 * 1024 * 1024`
  - `formatMb(bytes: number): string` → `"23,4 MB"` (uma casa, vírgula)
  - `oversizeMessage(file: { size: number }): string | null` → `"A foto tem 23,4 MB e o limite é 20 MB."` ou `null`
  - `uploadErrorMessage(err: unknown, file: { size: number }): string`
    - `ApiError` 413 cuja mensagem é `"Erro 413"` (sem JSON) → `"A foto é grande demais para o servidor (X MB). Avise o responsável pelo site para aumentar o limite de upload (client_max_body_size do Nginx)."`
    - `ApiError` status 0 → `"Não foi possível enviar a foto. Verifique a internet e tente de novo."`
    - outro `ApiError` → a mensagem dele; qualquer outra coisa → a mensagem de rede.

- [ ] **Step 1:** Testes das três funções com os textos acima, incluindo 20 MB exatos (`null`) e 20 MB + 1 byte.
- [ ] **Step 2:** `cd client && npx ng test --watch=false --include src/app/utils/upload-error.spec.ts` → falha (módulo inexistente).
- [ ] **Step 3:** Implementar. No `product-form`: checar `oversizeMessage` antes de enviar; no `catch`, usar `uploadErrorMessage`; o título do toast nas fotos extras é `Erro ao enviar "<nome do arquivo>"`; as fotos já enviadas permanecem.
- [ ] **Step 4:** Testes do client passam.
- [ ] **Step 5:** Commit `feat(client): mensagens claras quando a foto não pode ser enviada`.

### Task 3: Login e painel no celular

**Files:**
- Modify: `client/src/app/components/navbar/navbar.html`

- [ ] **Step 1:** O wrapper do botão de conta deixa de ser `hidden sm:block`. O painel suspenso fica `fixed inset-x-4 top-20` no celular e `sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-80` a partir de `sm`.
- [ ] **Step 2:** No menu do celular, depois de Atacado: "Painel Admin" (se `authService.isAdmin()`) e "Minha conta" (se logado), fechando o menu ao clicar.
- [ ] **Step 3:** Verificar no Chrome com viewport 390x844: botão "Entrar" visível; o painel cabe na tela; o menu mostra "Painel Admin" para admin. Testes e build do client passam.
- [ ] **Step 4:** Commit `feat(client): entrar, minha conta e painel admin pelo celular`.

### Fechamento

- [ ] `npm test`, `npm run typecheck`, `cd client && npx ng test --watch=false`, `npm run build`.
- [ ] Atualizar `CLAUDE.md` (limite de upload de 20 MB em Operação) e commitar junto com o spec e o plano.
