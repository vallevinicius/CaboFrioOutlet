import './env.js';
import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { ordersRouter } from './routes/orders.js';
import { settingsRouter } from './routes/settings.js';
import { uploadRouter } from './routes/upload.js';
import { CLIENT_DIST, UPLOADS_DIR } from './paths.js';
import { usersRouter } from './routes/users.js';
import { heroSlidesRouter } from './routes/hero-slides.js';
import { checkoutRouter } from './routes/checkout.js';
import { shippingRouter } from './routes/shipping.js';
import { reviewsRouter } from './routes/reviews.js';
import { favoritesRouter } from './routes/favorites.js';
import { reportsRouter } from './routes/reports.js';
import { wholesaleRouter } from './routes/wholesale.js';
import { rolesRouter } from './routes/roles.js';
import { staffRouter } from './routes/staff.js';
import { mountApiDocs } from './openapi/docs.js';
import { seoRouter, sendIndexWithSeo } from './seo/routes.js';
import { corsOrigin, createRateLimiter, securityHeaders, staticCacheControl } from './middleware/security.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
// Atrás de proxy (Nginx, Render etc.), defina TRUST_PROXY=1 para o limitador enxergar o IP real.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(securityHeaders);
app.use(compression());
app.use(cors({ origin: corsOrigin(process.env.SITE_URL, process.env.NODE_ENV) }));
app.use(express.json());
// Nomes de upload são UUIDs (conteúdo nunca muda): cache longo.
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

// Barra tentativa de adivinhar senha e criação em massa de contas.
app.use('/api/auth/login', createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }));
app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/staff', staffRouter);
app.use('/api/hero-slides', heroSlidesRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/shipping', shippingRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/reports', reportsRouter);
// Formulário público de atacado: no máximo 5 pedidos por hora por IP (só no POST).
app.post('/api/wholesale/quotes', createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }));
app.use('/api/wholesale', wholesaleRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
mountApiDocs(app, process.env.NODE_ENV);

app.use(seoRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Serve o build do Angular (client/dist/client/browser) e faz fallback de SPA
// para qualquer rota que não seja /api ou /uploads.
const clientDist = CLIENT_DIST;
// index: false — o index.html passa por sendIndexWithSeo para receber as tags de SEO da rota.
app.use(
  express.static(clientDist, {
    index: false,
    setHeaders: (res, filePath) => res.setHeader('Cache-Control', staticCacheControl(filePath)),
  }),
);
app.get(/^(?!\/api|\/uploads).*/, sendIndexWithSeo(path.join(clientDist, 'index.html')));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Aplicação rodando em http://localhost:${PORT}`);
});
