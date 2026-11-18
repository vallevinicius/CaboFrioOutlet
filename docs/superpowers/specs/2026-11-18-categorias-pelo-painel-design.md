# Categorias gerenciadas pelo painel — design

Data: 2026-11-18 · Tamanho: projeto

## Por quê

A loja vai ganhar categorias novas de roupa além de camisas, calças, bermudas e bonés, e outras podem entrar depois. O Vinicius quer criá-las pelo painel admin, sem precisar mexer no código a cada categoria.

## Situação atual

- `Product.category` no banco é texto livre (`String`). Os valores atuais são `camisas`, `calças`, `bermudas` e `bonés`.
- As quatro categorias estão fixas no código, em cerca de 15 lugares:
  - **Dados e tipos:** `client/src/app/data/categories.ts` (nome, slug, frase, descrição) e o tipo `ProductCategory`.
  - **Rotas:** `/camisas`, `/calcas`... em `app.routes.ts`.
  - **Navegação:** navbar e rodapé.
  - **Home:** os quadros de "Escolha o seu estilo" (fotos em `placeholders/`) e as vitrines por categoria.
  - **Páginas:** listagem, página de produto e formulário de atacado.
  - **Painel:** formulário de produto.
  - **Servidor:** SEO e sitemap (`server/seo/meta.ts`), validação e e-mail do atacado (`QUOTE_CATEGORIES`, `CATEGORY_LABEL`) e enum no OpenAPI.
- As medidas de embalagem padrão por categoria (`package-defaults`) caem nas de camisas quando a categoria é desconhecida.

## Objetivos

1. Criar, editar, ocultar/reativar, reordenar e apagar categorias numa aba "Categorias" do painel, inclusive pelo celular.
2. Uma categoria salva aparece sozinha em todo o site:
   - menu e rodapé;
   - página `/<slug>`;
   - quadro na home e vitrine na home;
   - formulário de produto e formulário de atacado;
   - SEO da página e sitemap.
3. As quatro categorias atuais passam para o banco e ficam editáveis do mesmo jeito, mantendo os endereços (`/camisas`, `/calcas`, `/bermudas`, `/bones`) e os produtos já cadastrados.

**Não objetivos:** guia de medidas por categoria (fica como está), medidas de embalagem configuráveis por categoria (categoria nova usa as de camisa; o produto continua ajustável), subcategorias.

**Antiobjetivos:**
- Quebrar endereços já indexados pelo Google.
- Deixar produto apontando para categoria inexistente.

## Decisões do Vinicius

- Gerenciado pelo painel, não no código, porque vão entrar mais categorias.
- As quatro atuais também vão para o painel (proposta aceita).

## Decisões do Claude (comunicadas e não contestadas)

- **Ocultar/reativar** em vez de só apagar. A categoria oculta some do menu, do rodapé, da home, do atacado e do sitemap, e a página `/<slug>` vira 404.
  - Os produtos dela continuam em "Todos os produtos", na busca e no link direto.
  - **Apagar** só é permitido sem produtos na categoria (409 com mensagem explicando).
- **Permissão:** a seção `produtos` (ver para listar no painel, editar para gravar). Sem perfil novo.
- **Identidade:**
  - `key` é o valor gravado em `Product.category`. Não muda depois de criada; as atuais mantêm `calças` e `bonés`.
  - `slug` é o endereço, gerado do nome na criação (minúsculas, sem acento, hífens) e também fixo, para o endereço não quebrar.
  - O nome pode mudar à vontade.
  - Categoria nova usa `key = slug`.
- **Slugs reservados** (não podem virar categoria): rotas e páginas existentes.
  - `produtos`, `produto`, `admin`, `checkout`, `minha-conta`, `favoritos`, `atacado`, `api`, `uploads`;
  - `sobre-nos`, `contato`, `trabalhe-conosco`, `trocas-e-devolucoes`, `perguntas-frequentes`, `guia-de-medidas`;
  - `robots.txt` e `sitemap.xml` (o formato do slug já impede o ponto).
- **SEO:**
  - título `"<Nome> multimarcas | <loja>"`;
  - descrição = campo "Descrição para o Google" da categoria ou, vazio, `"<Nome> multimarcas em Cabo Frio, com preço de outlet."`.
  - As quatro atuais recebem no banco as descrições que já usam hoje.
- **Quadros da home com N categorias:** o desenho atual (grande, pequeno, pequeno, largo) se repete a cada 4. A sobra fecha a linha:
  - 1 sobrando: largura toda;
  - 2 sobrando: metade cada;
  - 3 sobrando: uma larga e duas pequenas.

## Abordagens consideradas

- **Tabela `Category` no banco, com o site lendo da API (escolhida).** É o único jeito de criar sem mexer no código. O custo é a refatoração dos ~15 pontos fixos e uma rota dinâmica no Angular.
- **Lista de categorias num campo JSON das configurações (`Settings`):** dispensa tabela, mas complica a ordem, o "oculta" e a checagem de produtos. Também foge do padrão do projeto (banners têm tabela própria). Descartada.
- **Continuar no código:** descartada pelo Vinicius.

## Design

### Banco (`prisma/schema.prisma` + migration)

```prisma
model Category {
  id          String   @id @default(cuid())
  key         String   @unique   // valor em Product.category; nunca muda
  slug        String   @unique   // endereço /<slug>; nunca muda
  name        String
  intro       String   @default("") @db.VarChar(500)   // frase do topo da página
  description String   @default("") @db.VarChar(500)   // descrição para o Google
  image       String   @default("")            // foto do quadro na home
  order       Int      @default(0)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

`VARCHAR(500)` em vez de `TEXT`: no MySQL, coluna `TEXT` não aceita o valor padrão `''`.

A migration cria a tabela e insere as quatro atuais, com os textos de hoje e as fotos `/placeholders/cat-*.jpg`, nas ordens 0 a 3. Sem chave estrangeira em `Product` (YAGNI): a integridade fica na API.

### API `/api/categories`

| Rota | Acesso | Comportamento |
|---|---|---|
| `GET /` | público | ativas, por `order` |
| `GET /all` | `produtos` view | todas, com `productCount` |
| `POST /` | `produtos` edit | `{ name, intro?, description?, image? }`; gera slug; 400 se nome vazio/slug inválido ou reservado; 409 se slug já existe |
| `PUT /:id` | `produtos` edit | `{ name, intro, description, image, active }`; 404 se não existe |
| `PATCH /:id/move` | `produtos` edit | `{ direction: 'up' \| 'down' }`, igual aos banners |
| `DELETE /:id` | `produtos` edit | 409 "Esta categoria tem N produto(s). Mova os produtos ou oculte a categoria." se houver produtos |

- Toda entrada é validada com Zod.
- `POST /api/products` e `PUT /api/products/:id` passam a exigir uma `category` que exista no banco (400 "Categoria inválida.").

### Servidor: SEO, sitemap e atacado

- `sendIndexWithSeo`: um caminho `/<slug>` de categoria ativa gera título e descrição da categoria (as quatro saem de `PAGE_META`).
- O sitemap lista as categorias ativas com prioridade 0.8.
- Atacado: `validateQuote` recebe a lista de `key` das categorias ativas. O e-mail usa o nome da categoria vindo do banco.
- OpenAPI: `category` vira `string`.

### Client

- **`CategoryService`:** carrega `GET /api/categories` na inicialização e expõe:
  - `categories()` (tipo `CategoryPage`: `value`=key, `slug`, `path`, `label`=name, `intro`, `description`, `image`);
  - `byValue`, `bySlug`, `byPath`, `pathFor`;
  - `ready()` (promessa da primeira carga);
  - `refresh()`.
- **Fontes fixas que somem:** `data/categories.ts` deixa de ter a lista fixa (fica só `ALL_PRODUCTS_PATH` e o tipo), e `ProductCategory` vira `string`.
- **Rotas:** as rotas fixas por categoria saem; entra `{ path: ':categoria', component: ListingPage, canMatch: [categoryExists] }` antes do `**`.
  - O guard espera `ready()` e só deixa casar com slug ativo. Senão segue para o 404.
  - A `ListingPage` lê o slug do parâmetro da rota.
- **Consumidores** (navbar, rodapé, home e seus quadros/vitrines, listagem, produto, atacado, formulário de produto): passam a ler do serviço.
  - O formulário de produto lista também as ocultas, com "(oculta)", porque o admin pode cadastrar peça numa categoria oculta.
- **Quadros da home:** função pura `tileLayout(index, total)` com o desenho descrito acima. A foto vem de `image`, e categoria sem foto mostra fundo cinza com o nome.
- **Painel:**
  - aba "Categorias" depois de "Produtos", visível com `produtos` view;
  - lista com foto, nome, endereço, nº de peças, selo "Oculta", subir/descer, editar e apagar (desativado, com explicação, quando há peças);
  - formulário lateral, como o de banners: nome (mostra o endereço que será criado), foto (mesmas mensagens de erro de upload do produto), frase do topo, descrição para o Google e "Mostrar no site" (ativa/oculta).
  - Ao salvar, o painel chama `refresh()` para o site já refletir a mudança.

## Fica a critério de quem implementa

- Nome exato dos arquivos novos, seguindo o padrão do projeto.
- Texto de apoio das telas, em português e curto.

## Verificação

- **Servidor:**
  - rotas de categorias (permissão, slug reservado e duplicado, 409 ao apagar com produtos, mover);
  - produto com categoria inexistente → 400;
  - SEO e sitemap com categoria do banco;
  - atacado com categoria nova.
- **Client:** `tileLayout`, a geração de slug e o guard de rota.
- **Migration** aplicada num banco MySQL descartável: as quatro categorias inseridas.
- **Chrome:**
  - criar uma categoria no painel e vê-la no menu, na home e em `/<slug>`;
  - ocultar e ver o 404;
  - `/camisas` continua funcionando.
