<div align="center">

# Cabo Frio Outlet

**E-commerce for an urban apparel store: Angular storefront, Express API, Mercado Pago and Melhor Envio.**

🇧🇷 [Leia em português](README.pt-BR.md)

![Angular](https://img.shields.io/badge/Angular--DD0031?logo=angular&logoColor=white) ![Express](https://img.shields.io/badge/Express--000000?logo=express&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white) ![Mercado Pago](https://img.shields.io/badge/Mercado%20Pago--00B1EA?logo=mercadopago&logoColor=white)

</div>

## About

Online store for a clothing outlet. The Angular SPA is served by an Express API that handles the catalog, customer accounts, checkout with Mercado Pago (including installments) and shipping quotes through Melhor Envio. Store staff manage products, sizes, brands, home-page banners and orders from an admin area.

## Features

- Catalog with sizes, brands and stock per size
- Customer accounts and order history
- Checkout with Mercado Pago (cards with installments) and payment status tracking
- Shipping quote by ZIP code via Melhor Envio (sandbox flag configurable)
- Admin: products, hero slides, store settings, users and orders
- Image upload with `sharp` processing

## Tech stack

| Layer | Technology |
|---|---|
| Front-end | Angular (standalone), Tailwind CSS, Lucide |
| API | Express, TypeScript (`tsx`) |
| Data | MySQL + Prisma (12 versioned migrations) |
| Integrations | Mercado Pago, Melhor Envio |
| Auth | JWT + `bcryptjs` |

## Architecture

```
client/            Angular app (built into client/dist and served by Express)
server/
  routes/          auth, products, orders, checkout, shipping, hero-slides, settings, upload, users
  services/        mercadopago.ts, melhor-envio.ts, stock.ts
  middleware/      authentication / authorization
prisma/            schema and migrations
```
In development, `npm run dev` rebuilds the Angular app on change and restarts the API, so everything is served from one port.

## Getting started

**Prerequisites:** Node.js 20+, MySQL 8

```bash
npm install && npm --prefix client install
# create .env with the variables below
npm run db:migrate
npm run db:seed
npm run dev        # http://localhost:3001
```
Use `npm run dev:live` to run the Angular dev server with live reload instead.

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `PORT` | API port (default 3001) |
| `JWT_SECRET` | Secret for session tokens |
| `ADMIN_EMAIL / ADMIN_DEFAULT_PASSWORD` | First admin account |
| `MP_ACCESS_TOKEN / MP_PUBLIC_KEY` | Mercado Pago credentials |

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Angular watch build + API with reload |
| `npm run build` | Build the client and type-check the server |
| `npm run preview` | Serve the production build |
| `npm run db:migrate / db:seed / db:studio` | Prisma helpers |

## Team

- [Vinicius do Valle](https://github.com/vallevinicius)
- [Vinícius Diller](https://github.com/viniciusdiller)
