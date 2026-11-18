# Categorias pelo painel — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Categorias de produto vindas do banco, gerenciadas numa aba do painel, refletidas em todo o site.

**Architecture:** Tabela `Category` (key/slug fixos, nome editável, ativa/oculta, ordem). API `/api/categories` com permissão `produtos`. O servidor usa o banco no SEO, no sitemap, no atacado e na validação de produto. O client troca as listas fixas por um `CategoryService` e uma rota dinâmica `/:categoria` com `canMatch`.

**Tech Stack:** Prisma 6 + MySQL, Express 5, Zod 4, Vitest/Supertest; Angular 21 (signals), Tailwind 3.

**Spec:** `docs/superpowers/specs/2026-11-18-categorias-pelo-painel-design.md`

## Global Constraints

- `key` e `slug` nunca mudam depois de criados. As quatro atuais: keys `camisas`, `calças`, `bermudas`, `bonés`; slugs `camisas`, `calcas`, `bermudas`, `bones`.
- Slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, no máximo 60 caracteres. Reservados: `produtos`, `produto`, `admin`, `checkout`, `minha-conta`, `favoritos`, `atacado`, `api`, `uploads`, `sobre-nos`, `contato`, `trabalhe-conosco`, `trocas-e-devolucoes`, `perguntas-frequentes`, `guia-de-medidas`.
- Permissão: `produtos` (`view` para `GET /all`, `edit` para gravar).
- Mensagens em português, como no spec.

## Review Focus

- Nome que gera slug vazio (ex.: "!!!") → 400 "Escolha um nome com letras ou números.".
- Nome com acento e espaços ("Camisas Polo Ção") → slug `camisas-polo-cao`.
- Categoria oculta acessada por `/<slug>` → 404 do Angular, não a listagem vazia.
- Produto de categoria oculta continua em `/produtos` e no link direto.
- Home com 5, 6 e 7 categorias: o grid fecha a linha sem buracos (`tileLayout`).

---

### Task 1: Banco

**Files:** Modify `prisma/schema.prisma`; Create `prisma/migrations/20261118120000_add_categories/migration.sql`

- [ ] Modelo `Category` exatamente como no spec.
- [ ] Migration: `CREATE TABLE` (no padrão das migrations existentes) + `INSERT` das quatro categorias (ids `cat_camisas`, `cat_calcas`, `cat_bermudas`, `cat_bones`), com `intro` de `client/src/app/data/categories.ts`, `description` de `server/seo/meta.ts` e `image` `/placeholders/cat-<slug>.jpg`.
- [ ] Verificar: `npx prisma validate`, `npx prisma generate` e `prisma migrate deploy` num banco descartável `cabofriooutlet_tmp_categorias` → 4 linhas. Apagar o banco depois.
- [ ] Commit `feat(db): tabela de categorias com as quatro atuais`.

### Task 2: API de categorias

**Files:** Create `server/utils/category-slug.ts` (+ `.test.ts`), `server/routes/categories.ts` (+ `.test.ts`); Modify `server/index.ts`, `server/openapi/spec.ts`

**Interfaces — Produces:**
- `slugify(name: string): string`
- `RESERVED_SLUGS: readonly string[]`
- `validateSlug(slug: string): string | null` (mensagem de erro ou `null`)
- `categoriesRouter` montado em `/api/categories`
- `listActiveCategories(): Promise<Category[]>` exportada de `server/routes/categories.ts`, para SEO e atacado

- [ ] Testes de `slugify` (acentos, espaços, símbolos, hífens repetidos, 60 caracteres) e de `validateSlug` (vazio, reservado).
- [ ] Testes da rota:
  - `GET /` só ativas e ordenadas;
  - `GET /all` exige `produtos` view e traz `productCount`;
  - `POST` cria com slug gerado e `order` = último + 1;
  - `POST` reservado → 400; `POST` duplicado → 409;
  - `PUT` atualiza nome/ativa, 404 se não existe;
  - `PATCH move`;
  - `DELETE` com produtos → 409 com a mensagem do spec; sem produtos → 204;
  - sem permissão → 401/403.
- [ ] Implementar com Zod; montar em `server/index.ts`; OpenAPI: `category` → `z.string()` e rotas novas.
- [ ] `npm test` e `npm run typecheck` verdes. Commit `feat(server): API de categorias`.

### Task 3: Servidor usa o banco

**Files:** Modify `server/routes/products.ts`, `server/seo/meta.ts`, `server/seo/routes.ts`, `server/utils/wholesale.ts`, `server/routes/wholesale.ts`, `server/services/wholesale-email.ts` e os testes correspondentes

- [ ] Produto: `POST`/`PUT` com `category` que não existe → 400 "Categoria inválida." (teste).
- [ ] SEO:
  - tirar as 4 de `PAGE_META` e `LISTING_PATHS`;
  - `SeoContext` ganha `category?: { name; description }`;
  - título `"<Nome> multimarcas | <loja>"`, descrição com fallback do spec;
  - `buildSitemapXml(baseUrl, products, categories: { slug }[])`;
  - testes atualizados.
- [ ] Atacado: `validateQuote(body, allowedCategories: string[])`; o e-mail recebe `labels: Record<string, string>` (testes).
- [ ] Commit `feat(server): SEO, sitemap, atacado e produtos usam as categorias do banco`.

### Task 4: Base no client

**Files:** Create `client/src/app/services/category.service.ts`, `client/src/app/guards/category.guard.ts`, `client/src/app/utils/category-tiles.ts` (+ specs); Modify `client/src/app/data/categories.ts`, `client/src/app/types/product.ts`, `client/src/app/app.routes.ts`, `client/src/app/pages/listing-page/listing-page.ts`

**Interfaces — Produces:**
- `CategoryService`: `categories: Signal<CategoryPage[]>` (ativas), `ready(): Promise<void>`, `refresh(): Promise<void>`, `byValue(v)`, `bySlug(s)`, `byPath(p)`, `pathFor(v): string`.
- `CategoryPage { id; value; slug; path; label; intro; description; image }`.
- `categoryExists: CanMatchFn`.
- `tileLayout(index: number, total: number): { layout: string; titleSize: string }`.

- [ ] Specs:
  - `tileLayout` com 4 (os valores atuais exatos), 5, 6 e 7;
  - guard: ativo → `true`, desconhecido → `false`, espera `ready()`.
- [ ] Implementar; `ProductCategory` = `string`; rota `:categoria` antes de `**`; `ListingPage` lê o parâmetro.
- [ ] Commit `feat(client): categorias vindas da API e rota dinâmica`.

### Task 5: Consumidores no client

**Files:** Modify navbar, footer (+ `data/footer-links.ts`), `storefront-page`, `category-tiles`, `category-showcase`, `product-page`, `wholesale-page`, `types/wholesale.ts`, `admin/product-form`

- [ ] Trocar `CATEGORY_PAGES`/funções fixas pelo `CategoryService`. O formulário de produto lista todas (via `GET /all`) com "(oculta)".
- [ ] Testes e build do client verdes. Commit `feat(client): menu, home, atacado e formulário de produto usam as categorias do painel`.

### Task 6: Aba "Categorias" no painel

**Files:** Create `client/src/app/components/admin/tabs/categories-tab/*`, `client/src/app/components/admin/category-form/*`, `client/src/app/types/category.ts`; Modify `admin-dashboard.ts/.html`

- [ ] A aba aparece com `produtos` view e fica depois de Produtos. A lista e o formulário seguem o spec; o upload usa `oversizeMessage`/`uploadErrorMessage`; depois de gravar, chama `CategoryService.refresh()`.
- [ ] Commit `feat(client): aba Categorias no painel`.

### Task 7: Fechamento

- [ ] Chrome (servidor falso com estado): criar "Jaquetas" e conferir menu, home e `/jaquetas`; ocultar e ver 404; `/camisas` continua funcionando; celular 390px sem rolagem lateral.
- [ ] `npm test`, `npm run typecheck`, `cd client && npx ng test --watch=false`, `npm run build`.
- [ ] Atualizar `CLAUDE.md` (domínio, arquitetura, endpoints, operação: rodar `npx prisma migrate deploy`). Commit `docs: categorias pelo painel`.
