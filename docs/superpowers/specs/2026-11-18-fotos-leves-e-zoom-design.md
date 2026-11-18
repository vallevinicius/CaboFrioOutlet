# Fotos leves, zoom e setas na página do produto — design

Data: 2026-11-18 · Tamanho: projeto pequeno · Aprovado pelo Vinicius (caminho A + zoom + setas na mesma branch)

## Por quê

As fotos demoram a carregar, principalmente no celular. Medido em produção (`cabofriooutlet.com.br`):

- cada foto de produto tem 160–255 KB (1000×1333 JPEG) e leva 1–1,8 s;
- o servidor entrega cerca de 200 KB/s;
- o cartão no celular tem ~180 px de largura, mas baixa a foto de 1000 px;
- cada cartão também baixa a segunda foto (a do hover), que no celular nunca aparece;
- os quadros da home (`/placeholders/cat-*.jpg`) pesam 100–270 KB.

O Vinicius quer carregamento rápido sem perder muita qualidade. Na página do produto, quer o zoom "padrão" ao passar o mouse ou o dedo, e setas para trocar de foto no celular.

## Abordagens

- **A) Versões por tamanho em WebP, geradas sob demanda (escolhida).** O cartão cai de ~230 KB para ~30–40 KB.
- **B) Só trocar para WebP de 1000 px.** O cartão ficaria com ~90 KB. Descartada: ganho menor num servidor lento.
- **Dentro da A:** gerar as versões só no upload exigiria um script de conversão para as fotos antigas e os placeholders. Gerar sob demanda no primeiro pedido, com cache em disco, cobre tudo sem script.

## Design

### Servidor: `GET /img/:width/:dir/:file`

- `width` ∈ {480, 1200}; `dir` ∈ {`uploads`, `placeholders`}; `file` casa `^[A-Za-z0-9._-]{1,120}\.(jpe?g|png|webp)$`.
  - Qualquer outra coisa → 404.
  - Sem `/` nem `..`, o que impede path traversal.
- **Origem do arquivo:** `uploads` → `UPLOADS_DIR`; `placeholders` → `CLIENT_DIST/placeholders`. Origem inexistente → 404.
- **Saída:** `sharp(src).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78 })`.
- **Cache em disco** em `IMAGE_CACHE_DIR` (padrão `<UPLOADS_DIR>/.variants/<width>/<dir>/<file>.webp`).
  - Gravação em arquivo temporário seguida de `rename`, para dois pedidos simultâneos não corromperem o arquivo.
  - O cache é regerado se a origem for mais nova que ele.
- **Cache HTTP:**
  - `uploads`: `public, max-age=2592000, immutable` (nomes são UUID);
  - `placeholders`: `public, max-age=86400`.
- `Content-Type: image/webp`.

### Upload

A foto original (JPEG, usada em e-mail, Open Graph e como origem das versões) passa de 1000 para **1600 px** de largura.

### Client

- **Função pura `optimizedImage(url, size)`** (`utils/optimized-image.ts`):
  - URL local `/uploads/...` ou `/placeholders/...` →
    - `thumb`: `src` = `/img/480/...`;
    - `full`: `src` = `/img/1200/...`;
    - `card`: `src` = `/img/480/...` e `srcset` = `/img/480/... 480w, /img/1200/... 1200w`.
  - Qualquer outra URL (externa, `data:`) → `{ src: url, srcset: null }`.
- **Diretiva `appImage`** (`[appImage]="url" imageSize="thumb|card|full"` + `sizes` opcional): aplica `src`/`srcset`/`sizes` no `<img>`.
- **Onde cada tamanho vale:**
  - `card`: cartão de produto e quadros da home;
  - `full`: foto principal da página do produto, ampliação e banner do topo;
  - `thumb`: carrinho, checkout, minha conta, atacado, miniaturas da galeria e listas e formulários do painel.
- **Segunda foto do cartão:** `hidden [@media(hover:hover)]:block`. Com `loading="lazy"` e `display: none`, o navegador não baixa.

### Página do produto

- **Setas** anterior/próxima sobre a foto principal, visíveis em todas as telas quando há mais de 1 foto.
  - Circulam (da última vai para a primeira).
  - Contador "2/4" e `aria-label` "Foto anterior"/"Próxima foto".
- **Zoom com mouse:** ao passar, `scale(2.5)` com `transform-origin` no ponto do cursor. Sai ao tirar o mouse. Clique abre a ampliação (como hoje).
- **Zoom no toque:**
  - toque liga o zoom no ponto tocado;
  - arrastar move o zoom (`touch-action: none` só enquanto o zoom está ligado);
  - novo toque desliga.
  - Botão "Ampliar foto" no canto abre a ampliação no celular.
- **Funções puras:** `zoomOrigin(x, y, rect)` → `{ x%, y% }` limitado a 0–100; `wrapIndex(i, n)`.

## Fora do escopo

Mudar o visual, mexer nas fotos externas (Unsplash), swipe para trocar de foto, pinça.

## Verificação

- Testes do endpoint: largura, pasta e nome inválidos → 404; gera WebP na largura certa; cache em disco reaproveitado; não amplia foto pequena.
- Testes de `optimizedImage`, `zoomOrigin` e `wrapIndex`.
- Chrome com fotos de verdade: peso transferido na home e na listagem antes × depois, nitidez pelas capturas, setas e zoom no celular (390 px).
