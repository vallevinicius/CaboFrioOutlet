# Subcategorias — design

Data: 2026-11-18 · Tamanho: projeto pequeno · Aprovado pelo Vinicius

## Por quê

Dentro de cada categoria (ex.: Camisas) o Vinicius quer subcategorias, como "Camisa básica" e "Camisa estampada", criadas pelo painel. No site elas devem:

- ficar na própria página da categoria (sem página separada);
- descer no menu ao passar o mouse, ou ao tocar, no celular.

## Abordagens

- **Só filtro na página da categoria, com `?tipo=<slug>` na URL (escolhida pelo Vinicius: "fique na página das camisas").** O link dá para compartilhar, sem custo de SEO e sitemap.
- **Página própria `/camisas/basicas`:** descartada pelo Vinicius.

## Design

### Banco

```prisma
model Subcategory {
  id         String   @id @default(cuid())
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  slug       String   // gerado do nome; único dentro da categoria; não muda
  name       String
  order      Int      @default(0)
  active     Boolean  @default(true)
  products   Product[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([categoryId, slug])
}
```

- `Category` ganha `subcategories Subcategory[]`.
- `Product` ganha `subcategoryId String?` (relação com `onDelete: SetNull`; o apagar é barrado na API quando há peças).

### API (em `categoriesRouter`)

| Rota | Acesso | Comportamento |
|---|---|---|
| `GET /api/categories` | público | cada categoria traz `subcategories: [{ id, slug, name }]` (só ativas, em ordem) |
| `GET /api/categories/all` | `produtos` view | traz todas as subcategorias, com `active` e `productCount` |
| `POST /api/categories/:id/subcategories` | `produtos` edit | `{ name }`. Slug gerado do nome (`slugify`). Vazio → 400 "Escolha um nome com letras ou números."; repetido na mesma categoria → 409; categoria inexistente → 404 |
| `PUT /api/categories/subcategories/:subId` | `produtos` edit | `{ name, active }` (slug não muda) |
| `PATCH /api/categories/subcategories/:subId/move` | `produtos` edit | `{ direction }`, dentro da própria categoria |
| `DELETE /api/categories/subcategories/:subId` | `produtos` edit | com peças → 409 "Esta subcategoria tem N produto(s). Mova os produtos ou oculte a subcategoria." |

- Apagar categoria (já sem peças) apaga junto as subcategorias dela.
- **Produto:** `subcategoryId` opcional.
  - Informado, precisa existir e ser da mesma categoria do produto. Senão → 400 "Subcategoria inválida.".
  - `null` limpa; ausente no `PUT` não muda.
  - A lista de produtos devolve `subcategoryId`.

### Client

- **Função pura `visibleSubcategories(category, products)`:** as subcategorias ativas da categoria que têm ao menos 1 peça de varejo. Usada na listagem e no menu.
- **Listagem `/<categoria>`:**
  - segunda fileira de botões "Todas · <subcategorias>";
  - clicar faz `?tipo=<slug>`, mantendo os outros parâmetros;
  - `tipo` desconhecido → mostra todas.
- **Menu do computador:** categoria com subcategorias visíveis abre um painel ao passar o mouse (ou com foco do teclado), com "Ver todas" e cada subcategoria (`/camisas?tipo=basicas`).
- **Menu do celular:** setinha ao lado da categoria. Tocar nela expande ou recolhe as subcategorias; tocar no nome abre a categoria.
- **Painel, aba Categorias:**
  - botão "Subcategorias (N)" em cada linha abre a lista abaixo dela;
  - nela: campo para criar, e em cada item renomear, subir/descer, ocultar/mostrar e apagar (bloqueado com peças).
- **Formulário de produto:** campo "Subcategoria (opcional)" só com as da categoria escolhida, inclusive ocultas com "(oculta)". Trocar de categoria limpa o campo.

## Fora do escopo

Página própria, SEO e sitemap de subcategoria; atacado por subcategoria.

## Verificação

- Testes das rotas de subcategoria e da validação do produto.
- Teste de `visibleSubcategories`.
- Migration aplicada num MySQL descartável.
- Ponta a ponta no Chrome com servidor real:
  - criar "Básicas" em Camisas;
  - associar uma peça;
  - ver o botão em `/camisas` e o filtro funcionando;
  - painel do menu no hover (computador) e setinha no celular.
