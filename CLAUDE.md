# CLAUDE.md — Cabo Frio Outlet

Guia do projeto para o Claude Code. As regras globais do Vinicius (`~/.claude/CLAUDE.md`) continuam valendo; aqui ficam só os fatos deste projeto.

## Domínio

Loja virtual da **Cabo Frio Outlet**, loja **multimarcas** de moda urbana (camisas, calças, bermudas, bonés e outras categorias cadastradas no painel) com preço de outlet, há 10 anos no Centro de Cabo Frio/RJ (Av. Júlia Kubitschek, 16, Ed. Premier Center, lojas 3 e 4).

- **Varejo:** vitrine, carrinho, checkout com Mercado Pago (cartão parcelado, Pix etc.) e frete pela Melhor Envio.
- **Atacado:** página `/atacado` com formulário de orçamento (`WholesaleQuote`). Cada produto tem um canal de venda (`SalesChannel`: `RETAIL`, `WHOLESALE` ou `BOTH`); peças só de atacado não aparecem no varejo nem no sitemap.
- **Categorias:** cadastradas no painel (tabela `Category`), não no código. Cada uma tem `key` (valor gravado em `Product.category`, nunca muda; as antigas são `camisas`, `calças`, `bermudas`, `bonés`), `slug` (endereço `/<slug>`, nunca muda), nome, foto do quadro da home, frase, descrição para o Google, ordem e ativa/oculta. Oculta some do site (página vira 404), mas as peças continuam em `/produtos`. Só dá para apagar sem peças.
- **Subcategorias:** cada categoria pode ter subcategorias (tabela `Subcategory`, slug único por categoria e fixo), criadas na aba Categorias. O produto tem `subcategoryId` opcional, sempre da mesma categoria (validado na API). No site não têm página própria: viram a fileira de botões na página da categoria (`/camisas?tipo=basicas`) e o painel do menu (hover no computador, setinha no celular). Só aparecem as que têm peças (`utils/subcategories.ts`).
- **Admin (`/admin`):** produtos, categorias, estoque por tamanho, banners da home, pedidos, orçamentos de atacado, clientes, configurações da loja e equipe com perfis de acesso.
- **Domínio de produção:** `https://cabofriooutlet.com.br` (sem `www`).

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Angular 21 (standalone, signals), Tailwind CSS 3, Lucide (`client/`) |
| API | Express 5 + TypeScript, rodando com `tsx` em dev e compilado para `server/dist` em produção |
| Dados | MySQL 8 + Prisma 6 (`prisma/schema.prisma`, migrations versionadas) |
| Validação | Zod 4 (também gera o OpenAPI com `@asteasolutions/zod-to-openapi`) |
| Autenticação | JWT + `bcryptjs` |
| Integrações | Mercado Pago, Melhor Envio (OAuth), Resend (e-mail), Google Places (avaliações) |
| Imagens | upload com `multer`, processamento com `sharp` |
| Testes | Vitest + Supertest no servidor; Vitest no client |

> Este projeto **não** segue o modelo de monorepo (pnpm + Turborepo + Nest/Next). É um app único com npm, e assim deve continuar, a menos que o Vinicius peça a migração.

## Arquitetura

```
client/              app Angular; build em client/dist/client/browser, servido pelo Express
  src/app/pages/     páginas (vitrine, listagem, produto, checkout, conta, favoritos, atacado, admin, institucionais)
  src/app/components/  componentes (admin/ tem as abas do painel)
  src/app/services/  chamadas à API e estado (carrinho, auth, favoritos...)
  src/app/data/      dados fixos (categorias, páginas institucionais, dados da loja)
server/
  index.ts           monta middlewares, routers, SEO e o fallback da SPA
  env.ts             carrega o .env da RAIZ do projeto (variáveis já definidas no processo têm prioridade)
  routes/            um router por recurso (+ testes *.test.ts ao lado)
  services/          regras de negócio e integrações (mercadopago, melhor-envio, email, access, reports...)
  middleware/        auth (JWT), permissions (perfis), security (headers, CORS, rate limit)
  seo/               robots.txt, sitemap.xml e tags <head> por rota (meta.ts + routes.ts)
  openapi/           spec e Swagger UI
  utils/             funções puras (cpf, cnpj, preços de atacado, conteúdo da home...)
prisma/              schema e migrations
docs/                specs e planos (docs/superpowers/)
uploads/             fotos enviadas pelo admin (fora do Git)
```

Pontos importantes:

- **Uma porta só:** o Express serve a API (`/api`), os uploads (`/uploads`) e o build do Angular. Qualquer rota fora de `/api` e `/uploads` cai em `sendIndexWithSeo`, que entrega o `index.html` com título, descrição, canonical, Open Graph e JSON-LD da rota já preenchidos.
- **Sem SSR:** o Angular renderiza no navegador. O que buscadores leem com certeza é o `<head>` injetado pelo servidor (`server/seo/meta.ts`). Página fixa nova que deve ser indexada precisa de entrada em `PAGE_META` (e entra no sitemap automaticamente). Páginas de categoria vêm do banco: `/<slug>` ativo recebe título `"<Nome> multimarcas | <loja>"` e a descrição da categoria, e o sitemap lista as ativas.
- **Categorias no client:** `CategoryService` carrega `/api/categories` (só ativas) e é a única fonte de categorias do site: menu, rodapé, home, listagem, produto e atacado. A rota `/:categoria` usa `canMatch` (`category.guard.ts`) e fica antes do `**`; por isso slugs de páginas fixas são reservados (`server/utils/category-slug.ts`). Nada de lista fixa de categorias no código.
- **Permissões:** a autorização é sempre no backend e lida do banco a cada requisição (não do token). Seções: `inicio`, `banners`, `produtos` (vale também para a aba Categorias), `estoque`, `pedidos`, `atacado`, `clientes`, `configuracoes`, cada uma com nível `view` ou `edit`. Use `requirePermission(secao, nivel)` / `requireAnyPermission(...)`; equipe e perfis exigem `requireSuperAdmin`. Rotas do cliente usam `requireAuth` e checam o dono do recurso no serviço.
- **CPF cifrado:** o CPF é guardado com AES-256-GCM (`DATA_ENCRYPTION_KEY`) mais um hash para busca. Nunca trocar a chave de um banco que já tem CPFs cifrados.
- **Upload de fotos:** até 20 MB (`MAX_UPLOAD_BYTES`, igual em `server/routes/upload.ts` e `client/src/app/utils/upload-error.ts`). O `sharp` aplica a orientação EXIF e salva JPG de até 1600px (a original: e-mail, Open Graph e origem das versões). Acima do limite, a API responde 413 em português; um 413 sem JSON vem do Nginx, e o front pede para aumentar o `client_max_body_size`.
- **Fotos no tamanho certo:** `GET /img/<480|800|1200>/<uploads|placeholders>/<arquivo>` gera WebP (q72) na primeira vez e guarda em `IMAGE_CACHE_DIR` (padrão `uploads/.variants`, que pode ser apagado: é refeito sob demanda). No client, use `<img [appImage]="url" imageSize="thumb|card|full">` (diretiva em `directives/app-image.directive.ts`), nunca `[src]` direto para foto de produto/categoria/banner. `card` usa `srcset` 480/800/1200; URL externa passa intacta.
- **Conciliação de pagamentos:** ao subir, o servidor confere a cada 2 minutos no Mercado Pago os pedidos pendentes (webhook perdido, página fechada).

## Convenções

- Código, mensagens da aplicação, comentários e nomes de branch em português do Brasil.
- Toda entrada da API é validada com Zod.
- Testes ficam ao lado do arquivo testado (`*.test.ts` no servidor, `*.spec.ts` no client).
- Funções puras em `utils/`; acesso a banco e integrações em `routes/` e `services/`. Sem camada de repository em cima do Prisma.
- Mudança no banco = nova migration com `npm run db:migrate` (nunca editar migration já aplicada).

## Endpoints (`/api`)

| Prefixo | Rotas principais | Acesso |
|---|---|---|
| `/auth` | `POST /register`, `POST /login`, `GET/PUT /me` | público (com rate limit) / logado |
| `/products` | `GET /`; `POST /`, `PUT /:id`, `DELETE /:id`; `PUT /:id/stock`, `DELETE /:id/stock/:size` | público / `produtos` ou `estoque` edit |
| `/orders` | `GET /mine`; `POST /`; `GET /`; `PATCH /:id/status` | logado / opcional / `pedidos` |
| `/checkout` | `GET /config`, `POST /pay`, `GET /orders/:id/status`, `POST /webhook` | público (webhook com assinatura HMAC) |
| `/shipping` | `POST /calculate` | público |
| `/shipping/melhor-envio` | `GET /status`, `POST /connect`, `GET /callback`, `DELETE /` | `configuracoes` (callback OAuth público) |
| `/settings` | `GET /`, `PUT /` | público / `configuracoes` edit |
| `/hero-slides` | `GET /`; `POST`, `PUT /:id`, `PATCH /:id/move`, `DELETE /:id` | público / `banners` edit |
| `/categories` | `GET /` (ativas, com subcategorias ativas); `GET /all` (todas, com nº de peças e subcategorias); `POST`, `PUT /:id`, `PATCH /:id/move`, `DELETE /:id` (409 se houver peças) | público / `produtos` view / `produtos` edit |
| `/categories` (subcategorias) | `POST /:id/subcategories`; `PUT`, `PATCH .../move`, `DELETE /subcategories/:subId` (409 se houver peças) | `produtos` edit |
| `/upload` | `POST /` | `produtos`, `banners` ou `configuracoes` edit |
| `/favorites` | `GET /`, `POST /merge`, `PUT/DELETE /:productId` | logado |
| `/reviews` | `GET /` | público (Google Places) |
| `/wholesale` | `POST /quotes`; `GET /quotes`, `PATCH /quotes/:id` | público (5/h por IP) / `atacado` |
| `/reports` | `GET /overview` | `inicio` view |
| `/users` | `GET /` | `clientes` view |
| `/staff`, `/roles` | CRUD da equipe e dos perfis | super admin |
| `/health` | `GET /` | público |

Fora de `/api`: `GET /robots.txt`, `GET /sitemap.xml`, `GET /img/:width/:dir/:file` (versões WebP das fotos). Documentação: Swagger UI em `/api/docs` fora de produção; em produção só `/api/docs.json`, para super admin.

## Variáveis de ambiente

Arquivo `.env` na raiz (modelo em `.env.example`, sempre atualizado e sem valores reais).

| Variável | Uso |
|---|---|
| `DATABASE_URL` | conexão MySQL. Local: `mysql://root@localhost:3306/cabofriooutlet` |
| `PORT` | porta do servidor (local: 3003) |
| `NODE_ENV` | `production` restringe o CORS ao `SITE_URL` e desliga o Swagger UI |
| `TRUST_PROXY` | `1` atrás de Nginx/proxy, para o rate limit ver o IP real |
| `SITE_URL` | URL pública sem barra final. Usada em canonical, sitemap, robots e no retorno OAuth da Melhor Envio. Produção: `https://cabofriooutlet.com.br` |
| `UPLOADS_DIR` | pasta das fotos (padrão `server/uploads`); aponte para disco persistente em produção |
| `IMAGE_CACHE_DIR` | opcional; pasta das versões WebP de `/img` (padrão `UPLOADS_DIR/.variants`) |
| `JWT_SECRET` | segredo dos tokens |
| `ADMIN_EMAIL`, `ADMIN_DEFAULT_PASSWORD` | primeiro super admin (criado pelo seed) |
| `DATA_ENCRYPTION_KEY` | 32 bytes em base64 (`openssl rand -base64 32`). **Obrigatória**; guardar cópia: perdida, os CPFs não voltam |
| `MELHOR_ENVIO_CLIENT_ID`, `MELHOR_ENVIO_CLIENT_SECRET` | app da Melhor Envio; retorno em `SITE_URL/api/shipping/melhor-envio/callback` |
| `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` | Mercado Pago (**o servidor não sobe sem `MP_ACCESS_TOKEN`**; em dev use a credencial de teste); webhook (evento "Order") em `SITE_URL/api/checkout/webhook` |
| `RESEND_API_KEY`, `EMAIL_FROM` | e-mails transacionais; vazio = envio ignorado |
| `GOOGLE_PLACES_API_KEY` | avaliações do Google (o Place ID fica no admin) |
| `GOOGLE_SITE_VERIFICATION` | código da meta tag do Google Search Console (chega com o PR #22) |

## Operação

```bash
npm install && npm --prefix client install   # dependências (o postinstall roda prisma generate)
npm run db:migrate                           # cria/atualiza o banco
npm run db:seed                              # dados iniciais e super admin
npm run dev                                  # Angular em watch + API com reload, em http://localhost:3003
npm run dev:live                             # dev server do Angular com live reload + API
npm run build                                # build do client + compilação do servidor
npm start                                    # produção (server/dist/index.js)
npm run db:studio                            # Prisma Studio
npm run db:encrypt-cpf                       # migração única: cifra CPFs antigos em texto puro
```

Produção:
- Deploy: `git pull`, `npm ci --include=dev`, `npm --prefix client ci --include=dev`, `npx prisma migrate deploy` (obrigatório quando há migration nova, como a de categorias), `npm run build`, reiniciar o PM2.
- `.env` com `NODE_ENV=production`, `TRUST_PROXY=1` e `SITE_URL=https://cabofriooutlet.com.br`.
- Redirecionar `www.cabofriooutlet.com.br` para o domínio sem `www`.
- Nginx com `client_max_body_size 21m;` (o padrão de 1 MB barra as fotos do celular).
- Google Search Console: verificar o domínio e enviar `https://cabofriooutlet.com.br/sitemap.xml`.
- O Perfil da Empresa no Google precisa ter o mesmo nome, endereço e telefone do site (busca local por "outlet em Cabo Frio" / "multimarcas em Cabo Frio").

## Testes

```bash
npm test                          # servidor (Vitest + Supertest, Prisma mockado)
npm run typecheck                 # tipos do servidor
cd client && npx ng test --watch=false   # client (Vitest)
npm run build                     # build completo
```

Antes de dizer que terminou: rodar os quatro e mostrar o resultado.

## Git

- Nunca commitar direto em `main`. Uma branch por tarefa, criada a partir da `main` atualizada: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` + contexto em kebab-case.
- Commits pequenos, mensagem no padrão `tipo(escopo): descrição` em português.
- Antes de commitar, `git status` para garantir que nada ignorável entrou (`.env`, `node_modules/`, `client/dist/`, `server/dist/`, `uploads/`, logs).
- Push e merge só quando o Vinicius pedir. As mudanças entram na `main` via pull request no GitHub.
- Feature que muda domínio, arquitetura, endpoints, variáveis, operação ou testes atualiza este arquivo na mesma branch.
