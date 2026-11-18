# Subcategorias — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subcategorias por categoria, gerenciadas no painel, como filtro na página da categoria e no menu.

**Architecture:** Tabela `Subcategory` ligada a `Category`, mais `Product.subcategoryId`. Rotas novas dentro de `categoriesRouter`; a API pública já devolve as subcategorias junto com as categorias. No client, `?tipo=<slug>` na listagem e um submenu na navbar.

**Tech Stack:** Prisma 6 + MySQL, Express 5, Zod; Angular 21; Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-subcategorias-design.md`

## Global Constraints

- Slug da subcategoria: `slugify(name)` de `server/utils/category-slug.ts`; único por categoria; não muda.
- Permissão: `produtos` (view para listar no painel, edit para gravar).
- Sem página própria, sem SEO ou sitemap novos.

## Review Focus

- Produto com subcategoria de outra categoria → 400.
- Trocar a categoria de um produto no painel limpa a subcategoria.
- `?tipo=` inexistente ou de outra categoria → lista a categoria toda.
- Apagar categoria sem peças, mas com subcategorias, não estoura erro de chave estrangeira.
- Subcategoria sem peças não aparece no site (nem botão nem menu).

---

### Task 1: Banco + API

**Files:** `prisma/schema.prisma`, migration nova; `server/routes/categories.ts` (+ test); `server/routes/products.ts` (+ test); `server/openapi/spec.ts`.

- [ ] Testes: CRUD de subcategoria (cria com slug, 409 repetido, 404 categoria, move, 409 apagar com peças, permissão); `GET /` e `/all` com subcategorias; apagar categoria apaga subcategorias; produto com subcategoria inválida ou de outra categoria → 400; lista de produtos com `subcategoryId`.
- [ ] Migration gerada por `prisma migrate diff` e aplicada num banco descartável.
- [ ] Implementar e documentar no OpenAPI. Commit.

### Task 2: Client — site

**Files:** `types/category.ts`, `types/product.ts`, `data/categories.ts`, `utils/subcategories.ts` (+ spec), `pages/listing-page/*`, `components/navbar/*`.

- [ ] Spec de `visibleSubcategories`.
- [ ] Fileira de botões na listagem com `?tipo=`; submenu no hover (computador) e setinha no celular.
- [ ] Commit.

### Task 3: Client — painel

**Files:** `services/category.service.ts`, `components/admin/tabs/categories-tab/*`, `components/admin/product-form/*`.

- [ ] Lista de subcategorias por categoria (criar, renomear, mover, ocultar, apagar); campo no formulário de produto.
- [ ] Commit.

### Task 4: Fechamento

- [ ] Ponta a ponta no Chrome com servidor real e banco descartável.
- [ ] As quatro verificações; `CLAUDE.md`. Commit de docs.
