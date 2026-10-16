<div align="center">

# Cabo Frio Outlet

**E-commerce de moda urbana: loja em Angular, API Express, Mercado Pago e Melhor Envio.**

🇺🇸 [Read in English](README.md)

![Angular](https://img.shields.io/badge/Angular--DD0031?logo=angular&logoColor=white) ![Express](https://img.shields.io/badge/Express--000000?logo=express&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white) ![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago--00B1EA?logo=mercadopago&logoColor=white)

</div>

## Sobre

Loja virtual de um outlet de roupas. A SPA em Angular é servida por uma API Express que cuida do catálogo, das contas de cliente, do checkout com Mercado Pago (inclusive parcelado) e da cotação de frete pelo Melhor Envio. A equipe da loja gerencia produtos, tamanhos, marcas, banners da home e pedidos numa área administrativa.

## Funcionalidades

- Catálogo com tamanhos, marcas e estoque por tamanho
- Conta do cliente e histórico de pedidos
- Checkout com Mercado Pago (cartão parcelado) e acompanhamento do pagamento
- Cotação de frete por CEP via Melhor Envio (modo sandbox configurável)
- Admin: produtos, banners da home, configurações da loja, usuários e pedidos
- Upload de imagens com processamento via `sharp`

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Angular (standalone), Tailwind CSS, Lucide |
| API | Express, TypeScript (`tsx`) |
| Dados | MySQL + Prisma (12 versioned migrations) |
| Integrações | Mercado Pago, Melhor Envio |
| Autenticação | JWT + `bcryptjs` |

## Arquitetura

```
client/            app Angular (build em client/dist, servido pelo Express)
server/
  routes/          auth, produtos, pedidos, checkout, frete, banners, configurações, upload, usuários
  services/        mercadopago.ts, melhor-envio.ts, stock.ts
  middleware/      autenticação / autorização
prisma/            schema e migrations
```
Em desenvolvimento, `npm run dev` recompila o Angular a cada alteração e reinicia a API, então tudo é servido numa porta só.

## Como rodar

**Pré-requisitos:** Node.js 20+, MySQL 8

```bash
npm install && npm --prefix client install
# crie o .env com as variáveis abaixo
npm run db:migrate
npm run db:seed
npm run dev        # http://localhost:3001
```
Use `npm run dev:live` para rodar o dev server do Angular com live reload.

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão MySQL |
| `PORT` | Porta da API (padrão 3001) |
| `JWT_SECRET` | Segredo dos tokens de sessão |
| `ADMIN_EMAIL / ADMIN_DEFAULT_PASSWORD` | Conta do primeiro admin |
| `MP_ACCESS_TOKEN / MP_PUBLIC_KEY` | Credenciais do Mercado Pago |

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Build do Angular em watch + API com reload |
| `npm run build` | Build do cliente e type-check do servidor |
| `npm run preview` | Serve o build de produção |
| `npm run db:migrate / db:seed / db:studio` | Atalhos do Prisma |

## Equipe

- [Vinicius do Valle](https://github.com/vallevinicius)
- [Vinícius Diller](https://github.com/viniciusdiller)
