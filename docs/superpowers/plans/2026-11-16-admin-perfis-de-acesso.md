# Admin: perfis de acesso e liquid glass — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin supremo cria perfis (Nenhum/Ver/Editar por tela) e usuários da equipe, o servidor impõe essas permissões, e o painel `/admin` ganha menu à esquerda em liquid glass com fundo escuro e a logo borrada.

**Architecture:** Duas tabelas novas (`Role`, `RolePermission`) e dois campos em `User` (`isSuperAdmin`, `roleId`). As permissões são lidas do banco a cada requisição administrativa por middlewares novos, que substituem `requireAdmin`. O Angular recebe as permissões em `/auth/me` e esconde ou trava as telas; a aba nova **Equipe** consome `/api/roles` e `/api/staff`.

**Tech Stack:** Express 5, Prisma 6 (MySQL), Zod 4 + zod-to-openapi, Vitest + Supertest + vitest-mock-extended; Angular (standalone, signals) + Tailwind 3 + lucide-angular.

**Spec:** `docs/superpowers/specs/2026-11-16-admin-perfis-de-acesso-design.md`

## Global Constraints

- Branch única do pedido: `feat/admin-perfis-de-acesso-liquid-glass`. **Nada de commit sem o "pode commitar" do dono**; os passos "Commit" abaixo só valem depois dessa autorização (commits segmentados: banco, backend, frontend).
- Telas (chaves fixas): `inicio`, `banners`, `produtos`, `estoque`, `pedidos`, `atacado`, `clientes`, `configuracoes`. **Equipe** não é permissão: só `isSuperAdmin`.
- Níveis: `VIEW` e `EDIT` no banco (enum `PermissionLevel`); `'view'` e `'edit'` na API e no front. `EDIT` inclui `VIEW`. Ausência de linha = Nenhum.
- Autorização no servidor a cada requisição, lida do banco; o JWT continua `{ sub, isAdmin }`, sem permissões.
- Prisma: migration via `prisma migrate dev`; `PrismaClient` só de `server/db.ts`; `select` explícito; DTOs sem `passwordHash`; erros do Prisma traduzidos (`P2002` → 409, `P2025` → 404); escritas relacionadas em `$transaction`.
- Senha da equipe: mínimo 8 caracteres, bcrypt (`bcryptjs`, custo 10), nunca devolvida. E-mail obrigatório, único, em minúsculas.
- Supremo: criado/marcado só pelo `npm run db:seed` (`ADMIN_EMAIL`); sem UI para criar outro. Perfil "Administrador" (`system = true`) imutável.
- Testes unitários isolados (Prisma mockado com `mockDeep`, sem banco). Nunca enfraquecer teste existente.
- Todo endpoint novo documentado em `server/openapi/spec.ts` (bearer, request/response DTO, erros).
- Visual: fundo escuro em degradê (âmbar-marrom → quase preto), logo `client/public/Logo Preto.png` grande e borrada, vidro com `backdrop-filter`, acento `#FFC700`, menu à esquerda; fallback sólido translúcido sem `backdrop-filter` e com `prefers-reduced-transparency`.

## Review Focus

1. Token válido de quem **perdeu o acesso** (`isAdmin=false`) ou trocou de perfil: próxima requisição reflete o banco (403), sem esperar o token expirar. → Task 3.
2. Perfil com `section` inválida ou nível inválido no corpo: rejeitado (422), nunca concede nada. → Task 6.
3. Apagar perfil em uso: 409; alterar/apagar "Administrador": 403; alterar ou remover o supremo (inclusive a si mesmo): 403. → Tasks 6 e 7.
4. E-mail duplicado com caixa diferente (`Ana@X.com` vs `ana@x.com`): 409. → Task 7.
5. Usuário só com **Ver** chamando a rota de escrita direto: 403 e nada gravado. → Tasks 4 e 5.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` + migration nova | `Role`, `RolePermission`, `PermissionLevel`, campos em `User`, dados do perfil "Administrador" |
| `server/services/access.ts` (novo) | Lista de telas, tipos, `loadAccess`, `allows` |
| `server/middleware/permissions.ts` (novo) | `requirePermission`, `requireAnyPermission`, `requireSuperAdmin` |
| `server/middleware/auth.ts` | exporta `readToken`; remove `requireAdmin` no fim |
| `server/routes/roles.ts`, `server/routes/staff.ts` (novos) | CRUD de perfis e da equipe |
| `server/routes/*.ts` existentes | trocam `requireAdmin` pelos novos middlewares |
| `server/routes/auth.ts` | `/me` e login devolvem `isSuperAdmin` e `permissions` |
| `server/seed.ts` | perfil "Administrador", supremo |
| `server/openapi/spec.ts` | novos endpoints |
| `client/src/app/utils/permissions.ts` (novo) | `canAccess` puro |
| `client/src/app/services/auth.service.ts`, `staff.service.ts` (novo) | `can()`, chamadas de Equipe |
| `client/src/app/components/admin/admin-dashboard/*` | shell com menu à esquerda |
| `client/src/app/components/admin/tabs/staff-tab/*`, `roles-panel/*` (novos) | aba Equipe |
| `client/src/styles.css` | classes `glass-*` e fundo do admin |

---

### Task 1: Banco — perfis, permissões e migração dos admins atuais

**Files:**
- Modify: `prisma/schema.prisma` (models `User`; novos `Role`, `RolePermission`, enum `PermissionLevel`, conforme o spec)
- Create: `prisma/migrations/<timestamp>_add_roles_permissions/migration.sql`

**Interfaces:**
- Produces: `prisma.role`, `prisma.rolePermission`, `User.isSuperAdmin: boolean`, `User.roleId: string | null`, `User.role`.

- [ ] **Step 1:** Editar o schema exatamente como no spec (`Role.name @unique`, `Role.system`, `RolePermission @@id([roleId, section])`, `User.roleId` com `onDelete: Restrict` e `@@index([roleId])`).
- [ ] **Step 2:** `npx prisma migrate dev --create-only --name add_roles_permissions` (gera o SQL sem aplicar).
- [ ] **Step 3:** Ao final do `migration.sql`, acrescentar o SQL de dados: inserir `Role` `id='role-administrador'`, `name='Administrador'`, `system=true`; inserir uma `RolePermission` `EDIT` para cada uma das 8 telas; `UPDATE User SET roleId='role-administrador' WHERE isAdmin = true`. **Não** marcar supremo aqui.
- [ ] **Step 4:** `npx prisma migrate dev` (aplica) e `npx prisma generate`. Conferir no banco local: `SELECT name FROM Role;` → `Administrador`; todo `User.isAdmin=1` com `roleId` preenchido.
- [ ] **Step 5:** `npm run typecheck` → sem erros.
- [ ] **Step 6: Commit** (após autorização) `feat(banco): perfis de acesso e permissões por tela`.

---

### Task 2: Serviço de acesso (`loadAccess` / `allows`)

**Files:**
- Create: `server/services/access.ts`, `server/services/access.test.ts`

**Interfaces:**
- Produces:
  - `export const SECTIONS = ['inicio','banners','produtos','estoque','pedidos','atacado','clientes','configuracoes'] as const;`
  - `export type Section = (typeof SECTIONS)[number]; export type Level = 'view' | 'edit'; export type Permissions = Partial<Record<Section, Level>>;`
  - `export interface StaffAccess { isAdmin: boolean; isSuperAdmin: boolean; permissions: Permissions }`
  - `export async function loadAccess(userId: string): Promise<StaffAccess | null>` — `null` se o usuário não existe. Usa `prisma.user.findUnique` com `select` de `isAdmin`, `isSuperAdmin` e `role.permissions`. Supremo recebe `edit` em todas as telas. Quem não é `isAdmin` recebe `permissions: {}`.
  - `export function allows(access: StaffAccess, section: Section, level: Level): boolean` — `edit` satisfaz `view`; só `isAdmin` ou supremo pode passar.

- [ ] **Step 1: Escrever os testes** (`access.test.ts`, mock de `../db` no padrão de `orders.test.ts`):
  - `loadAccess` devolve `null` para usuário inexistente.
  - cliente comum (`isAdmin=false`) → `isAdmin:false`, `permissions:{}`.
  - perfil com `produtos: EDIT` e `pedidos: VIEW` → `{ produtos:'edit', pedidos:'view' }`.
  - supremo → as 8 telas em `'edit'`, mesmo sem `roleId`.
  - `allows`: `edit` permite `view` e `edit`; `view` permite `view` e **nega** `edit`; seção ausente nega; `isAdmin:false` nega mesmo com permissão no objeto.
- [ ] **Step 2:** `npx vitest run server/services/access.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `access.ts` conforme as assinaturas.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(server): serviço de acesso por perfil`.

---

### Task 3: Middlewares de permissão

**Files:**
- Modify: `server/middleware/auth.ts` (exportar `readToken`; estender `Express.Request` com `access?: StaffAccess`)
- Create: `server/middleware/permissions.ts`, `server/middleware/permissions.test.ts`
- Modify: `server/test/helpers.ts` (acrescentar `mockAccess`)

**Interfaces:**
- Consumes: `loadAccess`, `allows`, `Section`, `Level` (Task 2); `readToken` de `auth.ts`.
- Produces:
  - `requirePermission(section: Section, level: Level): RequestHandler`
  - `requireAnyPermission(...needs: [Section, Level][]): RequestHandler` (basta uma)
  - `requireSuperAdmin: RequestHandler`
  - todos preenchem `req.user` e `req.access`. Sem token → 401; usuário sem acesso à equipe ou sem a permissão → 403.
  - helper de teste `mockAccess(prisma, userId, access: Partial<StaffAccess> | null)` que programa `prisma.user.findUnique` para o `loadAccess`.

- [ ] **Step 1: Escrever os testes** (rota dummy montada com `appWith`):
  - sem token → 401; token inválido → 401.
  - token de usuário que **não existe mais** (`loadAccess` → `null`) → 401.
  - **Review Focus 1:** token com `isAdmin:true` no JWT, mas banco diz `isAdmin:false` → 403.
  - perfil com `pedidos:'view'`: `requirePermission('pedidos','view')` → 200; `requirePermission('pedidos','edit')` → 403.
  - perfil com `pedidos:'edit'` → 200 em `view` e `edit`.
  - `requireAnyPermission(['estoque','edit'],['produtos','edit'])`: passa com só `produtos:edit`; 403 com `produtos:view`.
  - `requireSuperAdmin`: supremo 200; admin com perfil "Administrador" (não supremo) 403.
  - a segunda chamada com o banco mudado reflete a mudança (sem cache).
- [ ] **Step 2:** `npx vitest run server/middleware/permissions.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. Mensagens: 401 `Autenticação necessária.`; 403 `Sem permissão para esta área.` (equipe sem a permissão) e `Acesso restrito à equipe.` (cliente comum). Sem cache de permissões.
- [ ] **Step 4:** → PASS. `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(server): middlewares de permissão por tela`.

---

### Task 4: Aplicar nas rotas de catálogo (produtos, banners, configurações, upload)

**Files:**
- Modify: `server/routes/products.ts:75,106,154,178`, `server/routes/hero-slides.ts:27,48,76,105`, `server/routes/settings.ts:91`, `server/routes/upload.ts:25`
- Modify (testes): `server/routes/products.test.ts`, `server/routes/settings.test.ts`
- Create: `server/routes/hero-slides.test.ts`, `server/routes/upload.test.ts`

**Interfaces:** Consumes `requirePermission`, `requireAnyPermission`, `mockAccess` (Task 3).

Mapa (escrita exige `edit`):
- `POST/PUT/DELETE /products` → `requirePermission('produtos','edit')`.
- `PUT /products/:id/stock` → `requireAnyPermission(['estoque','edit'],['produtos','edit'])`.
- `hero-slides` POST/PUT/PATCH/DELETE → `('banners','edit')`.
- `PUT /settings` → `('configuracoes','edit')`.
- `POST /upload` → `requireAnyPermission(['produtos','edit'],['banners','edit'],['configuracoes','edit'])`.

- [ ] **Step 1: Atualizar/escrever testes.** Nos testes existentes, trocar `tokenFor(id, true)` por token comum + `mockAccess(prisma(), id, { isAdmin: true, permissions: {...} })`, mantendo as asserções originais. Para cada rota acima, três casos: sem permissão → 403; **só `view` → 403 e `prisma.*.create/update/delete` não chamado** (Review Focus 5); `edit` → sucesso. Casos extras: estoque aceita `estoque:edit` sem `produtos`; upload aceita cada uma das três.
- [ ] **Step 2:** `npx vitest run server/routes/products.test.ts server/routes/settings.test.ts server/routes/hero-slides.test.ts server/routes/upload.test.ts` → FAIL.
- [ ] **Step 3:** Trocar os middlewares nas rotas conforme o mapa.
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `feat(server): permissões nas rotas de catálogo`.

---

### Task 5: Aplicar nas rotas de operação (pedidos, atacado, relatórios, clientes)

**Files:**
- Modify: `server/routes/orders.ts:29,207`, `server/routes/wholesale.ts:92,100`, `server/routes/reports.ts:9`, `server/routes/users.ts` (`GET /` e **remover** `PATCH /:id/admin`)
- Modify (testes): `server/routes/orders.test.ts`, `server/routes/wholesale.test.ts`, `server/routes/reports.test.ts`
- Create: `server/routes/users.test.ts`

Mapa:
- `GET /orders` → `('pedidos','view')`; `PATCH /orders/:id/status` → `('pedidos','edit')`.
- `GET /wholesale/quotes` → `('atacado','view')`; `PATCH /wholesale/quotes/:id` → `('atacado','edit')`.
- `GET /reports/overview` → `('inicio','view')`.
- `GET /users` → `('clientes','view')`. A lista **não inclui** `passwordHash` e continua listando todas as contas; o campo `isAdmin` fica só informativo.
- `PATCH /users/:id/admin` deixa de existir.

- [ ] **Step 1: Testes** no mesmo molde da Task 4 (sem permissão 403 / `view` lê / `view` não escreve / `edit` escreve). `users.test.ts`: `GET /api/users` sem `clientes` → 403; com `clientes:view` → 200 sem `passwordHash`; `PATCH /api/users/x/admin` → 404.
- [ ] **Step 2:** rodar os 4 arquivos → FAIL.
- [ ] **Step 3:** Aplicar o mapa; apagar a rota de promoção e o import que sobrar.
- [ ] **Step 4:** → PASS; `npx vitest run server` completo → tudo verde.
- [ ] **Step 5:** Remover `requireAdmin` de `server/middleware/auth.ts` (nenhum uso restante: `grep -rn requireAdmin server --include=*.ts` vazio) e `npm run typecheck`.
- [ ] **Step 6: Commit** `feat(server): permissões nas rotas de pedidos, atacado, relatórios e clientes`.

---

### Task 6: Rotas de perfis (`/api/roles`)

**Files:**
- Create: `server/routes/roles.ts`, `server/routes/roles.test.ts`
- Modify: `server/index.ts` (`app.use('/api/roles', rolesRouter)`)

**Interfaces:**
- Consumes: `requireSuperAdmin`, `SECTIONS`.
- Produces (DTO `RoleDto`): `{ id: string; name: string; system: boolean; userCount: number; permissions: { section: Section; level: 'view'|'edit' }[] }`.
- Rotas (todas `requireSuperAdmin`): `GET /` lista; `GET /:id`; `POST /` e `PUT /:id` com corpo Zod `{ name: string(1..40, trim), permissions: { section: z.enum(SECTIONS), level: z.enum(['view','edit']) }[] }` (seção repetida rejeitada); `DELETE /:id` → 204.

- [ ] **Step 1: Testes:** só supremo (admin comum 403, cliente 403); criar perfil feliz (201, DTO com níveis em minúsculas); **Review Focus 2:** `section:'equipe'` e `level:'admin'` → 422 e nenhuma escrita; seção repetida → 422; nome vazio → 422; nome duplicado (`P2002`) → 409; `PUT`/`DELETE` em perfil `system` → 403; `DELETE` com `userCount > 0` → 409 e `role.delete` não chamado; inexistente → 404; atualização troca as permissões dentro de `$transaction` (apaga e recria).
- [ ] **Step 2:** `npx vitest run server/routes/roles.test.ts` → FAIL.
- [ ] **Step 3:** Implementar com `select` explícito (`_count: { select: { users: true } }`), tradução `P2002`/`P2025` e mapeamento `VIEW`/`EDIT` ↔ `'view'`/`'edit'`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(server): CRUD de perfis de acesso`.

---

### Task 7: Rotas da equipe (`/api/staff`)

**Files:**
- Create: `server/routes/staff.ts`, `server/routes/staff.test.ts`
- Modify: `server/index.ts` (`app.use('/api/staff', staffRouter)`)

**Interfaces:**
- Produces (DTO `StaffDto`): `{ id, name, email, isSuperAdmin: boolean, role: { id: string; name: string } | null, createdAt: string }`.
- Rotas (todas `requireSuperAdmin`):
  - `GET /` → membros da equipe (`isAdmin = true`), mais antigos primeiro.
  - `POST /` corpo `{ name: string(1..80), email: string().email() → lower/trim, password: string(min 8), roleId: string }` → 201. Cria `isAdmin=true, roleId`. `roleId` inexistente → 422; e-mail existente (em qualquer conta, incluindo cliente) → 409.
  - `PATCH /:id` corpo `{ name?, roleId?, password? }` (ao menos um).
  - `DELETE /:id` → 204: `isAdmin=false, roleId=null` (a conta continua como cliente).
  - Alvo `isSuperAdmin` em `PATCH`/`DELETE` → 403 (`O admin supremo não pode ser alterado.`), inclusive o próprio supremo. Alvo que não é da equipe → 404.

- [ ] **Step 1: Testes:** só supremo; criação feliz (resposta **sem** `passwordHash` e sem `password`; hash gravado com bcrypt: `bcrypt.compare` verdadeiro); senha de 7 caracteres → 422; e-mail inválido → 422; **Review Focus 4:** e-mail com caixa diferente de um existente → 409 (o servidor normaliza para minúsculas antes de gravar e a colisão `P2002` vira 409); `roleId` inexistente → 422; `PATCH` troca perfil e nova senha rehasheada; **Review Focus 3:** `PATCH`/`DELETE` no supremo (incluindo o próprio id do token) → 403 e nada gravado; `DELETE` de membro comum → `isAdmin:false, roleId:null`; alvo inexistente ou cliente comum → 404.
- [ ] **Step 2:** `npx vitest run server/routes/staff.test.ts` → FAIL.
- [ ] **Step 3:** Implementar (Zod, `select` explícito, `bcrypt.hash(password, 10)`, tradução `P2002` → 409).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(server): criação e gestão de usuários da equipe`.

---

### Task 8: Auth devolve permissões; seed define o supremo

**Files:**
- Modify: `server/routes/auth.ts` (`serializeUser`, login, `/me`), `server/seed.ts`
- Create: `server/routes/auth.test.ts` (se não existir; senão estender)

**Interfaces:**
- Consumes: `loadAccess` (Task 2).
- Produces: `user` em `/auth/login`, `/auth/register` (sem acesso: `isSuperAdmin:false, permissions:{}`) e `/auth/me` ganha `isSuperAdmin: boolean` e `permissions: Permissions` (`{ [section]: 'view'|'edit' }`).

- [ ] **Step 1: Testes:** `/me` de cliente → `permissions: {}`, `isSuperAdmin:false`; de membro com perfil → permissões do perfil; de supremo → 8 telas `'edit'` e `isSuperAdmin:true`; login de membro devolve o mesmo formato; nenhuma resposta contém `passwordHash`.
- [ ] **Step 2:** `npx vitest run server/routes/auth.test.ts` → FAIL.
- [ ] **Step 3:** Estender `serializeUser` e chamar `loadAccess(user.id)` em login e `/me`.
- [ ] **Step 4:** `seed.ts`: (a) `upsert` do perfil "Administrador" (`id: 'role-administrador'`, `system: true`) com as 8 permissões `EDIT`; (b) se o usuário de `ADMIN_EMAIL` não existe, criá-lo com `isAdmin:true, isSuperAdmin:true, roleId` do perfil; (c) se existe, `update` para `isAdmin:true, isSuperAdmin:true` **sem tocar na senha**. Idempotente.
- [ ] **Step 5:** `npx vitest run server` → verde. Rodar `npm run db:seed` duas vezes no banco local: sem erro, e `SELECT email,isSuperAdmin FROM User WHERE isSuperAdmin=1` mostra só o `ADMIN_EMAIL`.
- [ ] **Step 6: Commit** `feat(server): auth devolve permissões e seed define o admin supremo`.

---

### Task 9: OpenAPI dos endpoints novos e alterados

**Files:**
- Modify: `server/openapi/spec.ts` (e `server/openapi/spec.test.ts` se ele enumera rotas)

**Interfaces:** Consumes os DTOs das Tasks 6–8.

- [ ] **Step 1:** Estender o teste do spec: o documento contém `/api/roles`, `/api/roles/{id}`, `/api/staff`, `/api/staff/{id}`, tem `security` bearer, e **não** contém `/api/users/{id}/admin`.
- [ ] **Step 2:** `npx vitest run server/openapi` → FAIL.
- [ ] **Step 3:** Registrar `Role`, `RoleInput`, `StaffMember`, `StaffInput`, `StaffUpdate`; documentar as rotas com `doc()` (`access: 'admin'`, erros 400/403/404/409/422); atualizar o schema do usuário de `/auth/me`/login com `isSuperAdmin` e `permissions`; remover a entrada de `PATCH /api/users/{id}/admin`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `docs(api): documenta perfis e equipe no OpenAPI`.

---

### Task 10: Front — tipos, `canAccess` e AuthService

**Files:**
- Create: `client/src/app/utils/permissions.ts`, `client/src/app/utils/permissions.spec.ts`
- Modify: `client/src/app/types/user.ts`, `client/src/app/services/auth.service.ts`

**Interfaces:**
- Produces:
  - `export type Section = 'inicio'|'banners'|'produtos'|'estoque'|'pedidos'|'atacado'|'clientes'|'configuracoes'; export type Level = 'view'|'edit'; export type Permissions = Partial<Record<Section, Level>>;`
  - `export function canAccess(permissions: Permissions | undefined, section: Section, level: Level): boolean`
  - `CustomerProfile` ganha `isSuperAdmin?: boolean; permissions?: Permissions`.
  - `AuthService`: `isSuperAdmin = computed(() => boolean)`, `can(section: Section, level: Level): boolean` (supremo → `true`).

- [ ] **Step 1: Escrever `permissions.spec.ts`:** `edit` permite `view` e `edit`; `view` permite `view` e nega `edit`; seção ausente nega; `undefined` nega.
- [ ] **Step 2:** `cd client && npx ng test --watch=false` → FAIL no spec novo.
- [ ] **Step 3:** Implementar `canAccess`, tipos e `AuthService.isSuperAdmin`/`can`.
- [ ] **Step 4:** `cd client && npx ng test --watch=false` → todos os specs passam; `npx ng build` sem erros.
- [ ] **Step 5: Commit** `feat(client): permissões no AuthService`.

---

### Task 11: Front — shell do admin (menu à esquerda, liquid glass escuro)

**Files:**
- Modify: `client/src/app/components/admin/admin-dashboard/admin-dashboard.html` e `.ts`, `client/src/styles.css`

**Interfaces:**
- Consumes: `AuthService.can`, `isSuperAdmin`, `user` (Task 10).
- Produces: `TABS` com campo `section`; aba `equipe` (visível só para o supremo) e `activeTab` incluindo `'equipe'` (renderiza `<app-staff-tab />`, criado na Task 13; até lá, o `@case` fica comentado).
- Classes em `styles.css` (`@layer components`): `.admin-bg` (degradê escuro + `::before` com a logo borrada: `background: url('/Logo Preto.png') center/contain no-repeat; filter: blur(22px) invert(1); opacity: .28`), `.glass` (`rgba(255,255,255,.08)`, `backdrop-filter: blur(26px) saturate(170%)`, borda `rgba(255,255,255,.18)`, brilho interno), `.glass-item`/`.glass-item-on` para o menu. `@supports not (backdrop-filter: blur(1px))` e `@media (prefers-reduced-transparency: reduce)` → fundo sólido `rgba(24,20,10,.92)`.

- [ ] **Step 1:** Em `.ts`, `visibleTabs = computed(() => TABS.filter(t => auth.can(t.section, 'view')))`; se a aba ativa sumir, ativar a primeira visível; `Equipe` só se `isSuperAdmin()`. Usuário sem nenhuma tela: mostrar mensagem "Seu perfil ainda não tem acesso a nenhuma tela." no lugar do conteúdo.
- [ ] **Step 2:** Reescrever o `.html`: `<div class="admin-bg min-h-screen flex">`; `<nav class="glass">` fixa à esquerda (logo + nome da loja no topo, itens, grupo "Administração" com Equipe, rodapé com nome do usuário e o nome do perfil ou "Admin supremo", botões "Ver loja" e Sair); área principal com cabeçalho em vidro e `<main>` com o `@switch`. Menu: `aria-label="Menu do painel"`, item ativo com `aria-current="page"`. Abaixo de `lg`, o menu vira gaveta aberta por botão de menu no topo.
- [ ] **Step 3:** Verificar no navegador (skill `run`): `npm run dev`, login como supremo → todas as telas + Equipe; criar manualmente (SQL/seed local) um perfil com poucas telas e confirmar que o menu mostra só elas.
- [ ] **Step 4:** `cd client && npx ng build` sem erros.
- [ ] **Step 5: Commit** `feat(client): painel admin com menu lateral em liquid glass`.

---

### Task 12: Front — telas existentes em vidro escuro e modo somente leitura

**Files:**
- Modify: `client/src/app/components/admin/tabs/*/*.html` e `.ts` (8 abas), `product-form`, `product-table`, `stock-input`, `banner-form`, `stat-card`

**Interfaces:** Consumes `AuthService.can`. Cada aba ganha `readonly canEdit = computed(() => this.auth.can('<seção>', 'edit'))` (Estoque usa `can('estoque','edit') || can('produtos','edit')`; Clientes é só leitura).

Mapa de classes (fundo escuro):
`bg-white` → `glass` (ou `bg-white/10`); `border-slate-200|300` → `border-white/15`; `text-slate-900` → `text-white`; `text-slate-500|600` → `text-white/60`; `hover:bg-slate-100` → `hover:bg-white/10`; botão `bg-slate-900 text-white` → `bg-accent text-black`; inputs → `bg-white/10 text-white placeholder:text-white/40 border-white/20 focus:border-accent`; tabelas: cabeçalho `text-white/50`, linhas `border-white/10`.

- [ ] **Step 1:** Aplicar o mapa em cada aba e componente listado (mecânico, sem mudar lógica).
- [ ] **Step 2:** Em cada aba, todo controle que dispara `POST/PUT/PATCH/DELETE` (salvar, apagar, mover, mudar status, upload, ajustar estoque) fica com `@if (canEdit())` ou `[disabled]="!canEdit()"`; formulários inteiros ficam `disabled` quando só há **Ver**, com um aviso discreto "Somente leitura".
- [ ] **Step 3:** Conferir contraste (texto ≥ 4.5:1 sobre o vidro) e foco visível em cada aba no navegador; `prefers-reduced-motion` não quebra nada.
- [ ] **Step 4:** `cd client && npx ng build` e `npx ng test --watch=false` verdes.
- [ ] **Step 5: Commit** `feat(client): abas do admin em vidro escuro e modo somente leitura`.

---

### Task 13: Front — aba Equipe (usuários e perfis) e limpeza da aba Clientes

**Files:**
- Create: `client/src/app/services/staff.service.ts`, `client/src/app/components/admin/tabs/staff-tab/staff-tab.{ts,html}`, `client/src/app/components/admin/tabs/staff-tab/roles-panel/roles-panel.{ts,html}`
- Modify: `admin-dashboard.{ts,html}` (ligar a aba), `customers-tab.{ts,html}` (remover `toggleAdmin` e o botão "Tornar admin")

**Interfaces:**
- Produces `StaffService` (usa `ApiService`): `listStaff(): Promise<StaffMember[]>`, `createStaff(input: { name; email; password; roleId }): Promise<StaffMember>`, `updateStaff(id, patch: { name?; roleId?; password? })`, `removeStaff(id)`, `listRoles(): Promise<Role[]>`, `saveRole(role: { id?: string; name: string; permissions: { section: Section; level: Level }[] })`, `deleteRole(id)`. Tipos `StaffMember` e `Role` iguais aos DTOs do servidor.
- `staff-tab`: lista de membros (nome, **e-mail**, perfil, badge "Supremo"), botão "Novo usuário" (formulário: nome, e-mail, senha provisória ≥ 8 com olhinho de mostrar, perfil), troca de perfil, redefinir senha, remover acesso (com confirmação). O supremo não mostra ações.
- `roles-panel`: lista de perfis (`system` somente leitura, com cadeado) e editor com a matriz **Nenhum / Ver / Editar** por tela (grupo de botões com `aria-pressed`), criar, renomear, apagar (erro 409 mostrado como toast "Perfil em uso por N usuários").

- [ ] **Step 1:** Implementar o serviço e as duas telas; erros da API via `ToastService` (`ApiError.message`).
- [ ] **Step 2:** Remover da aba Clientes a promoção a admin e o contador de admins que depende dela.
- [ ] **Step 3:** Verificação manual no navegador, como supremo: criar perfil "Estoquista" (Produtos e Estoque = Editar, Pedidos = Ver, resto Nenhum); criar usuário com e-mail e senha; sair; entrar com esse usuário → menu só com Produtos, Estoque e Pedidos; Pedidos sem botões de editar; chamar `PATCH /api/orders/:id/status` com o token dele (curl) → 403. Trocar o perfil dele como supremo e recarregar a página dele → menu atualizado.
- [ ] **Step 4:** `cd client && npx ng build` e `npx ng test --watch=false` verdes.
- [ ] **Step 5: Commit** `feat(client): aba Equipe com usuários e perfis de acesso`.

---

### Task 14: Verificação final

- [ ] `npx vitest run server` → tudo verde (reportar a contagem real).
- [ ] `npm run typecheck`, `npm run build` sem erros.
- [ ] `cd client && npx ng test --watch=false` verde.
- [ ] `grep -rn "requireAdmin" server --include=*.ts` → vazio.
- [ ] Swagger local (`/api/docs`) lista `/api/roles` e `/api/staff`.
- [ ] Fluxo manual da Task 13 repetido com o build de produção (`npm run build && npm start`).
- [ ] Avisar o dono: sem commit até o "pode commitar"; rollout em produção (não executado por mim): `git pull && npm ci && npm run build && npx prisma migrate deploy && npm run db:seed && pm2 restart cabofrio-backend`, e conferir quem ficou supremo.
