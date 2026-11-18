# Fotos leves, zoom e setas — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fotos em WebP no tamanho certo para cada lugar, zoom e setas na galeria do produto.

**Architecture:** Endpoint `/img/:width/:dir/:file` gera WebP sob demanda com cache em disco; diretiva `appImage` escolhe a versão; galeria com setas e zoom por pointer events.

**Tech Stack:** Express 5 + sharp; Angular 21; Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-fotos-leves-e-zoom-design.md`

## Global Constraints

- Larguras: 480 e 1200. WebP qualidade 78. Upload original: 1600 px JPEG q82.
- Só `uploads` e `placeholders`; nome `^[A-Za-z0-9._-]{1,120}\.(jpe?g|png|webp)$`.
- Nenhuma dependência nova.

## Review Focus

- `..`, `%2F` ou barra no nome → 404 (path traversal).
- Foto menor que 480 px não é ampliada.
- Dois pedidos simultâneos da mesma versão não quebram o arquivo do cache.
- URL externa (Unsplash) e `data:` passam intactas pela diretiva.
- Toque rápido na foto não abre a ampliação e liga o zoom; a página continua rolável fora do zoom.

---

### Task 1: Endpoint de versões (servidor)

**Files:** Create `server/routes/images.ts` (+ `.test.ts`); Modify `server/index.ts`, `server/paths.ts` (`IMAGE_CACHE_DIR`), `server/routes/upload.ts` (1600), `server/openapi/spec.ts` + `spec.test.ts`, `.env.example`.

**Produces:** `imagesRouter` montado em `/img`; `IMAGE_WIDTHS = [480, 1200]`.

- [ ] Testes: 404 para largura, pasta e nome inválidos (inclui `..`); WebP de 480 px a partir de JPEG de 1600 px; foto de 300 px fica com 300 px; segundo pedido serve do cache (o arquivo existe e não é regerado); cabeçalhos de cache por pasta.
- [ ] Implementar; montar antes do `express.static`; documentar no OpenAPI.
- [ ] `npm test`, `npm run typecheck`. Commit `feat(server): versões WebP das fotos sob demanda, com cache`.

### Task 2: Diretiva e uso no client

**Files:** Create `client/src/app/utils/optimized-image.ts` (+ spec), `client/src/app/directives/app-image.directive.ts`; Modify os ~20 `<img>` listados no spec.

**Produces:** `optimizedImage(url: string, size: 'thumb' | 'card' | 'full'): { src: string; srcset: string | null }`; diretiva `[appImage]` com `imageSize` e `sizes`.

- [ ] Spec de `optimizedImage` (local × externa × `data:`; os três tamanhos).
- [ ] Trocar os `[src]` pelas versões; segunda foto do cartão só com hover.
- [ ] Testes e build do client. Commit `feat(client): fotos no tamanho certo para cada lugar`.

### Task 3: Galeria com setas e zoom

**Files:** Create `client/src/app/utils/gallery.ts` (+ spec); Modify `product-page.ts/.html`.

**Produces:** `wrapIndex(i: number, n: number): number`; `zoomOrigin(x: number, y: number, rect: { left; top; width; height }): { x: number; y: number }`.

- [ ] Specs das duas funções (bordas, negativos, n=1).
- [ ] Setas + contador; zoom com mouse (hover) e toque (liga/move/desliga); botão "Ampliar foto".
- [ ] Commit `feat(client): zoom e setas na galeria do produto`.

### Task 4: Fechamento

- [ ] Chrome: peso antes × depois na home/listagem com fotos reais; capturas de nitidez; setas e zoom em 390 px.
- [ ] As quatro verificações; `CLAUDE.md` (endpoint `/img`, `IMAGE_CACHE_DIR`). Commit de docs.
