import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth';
import { productsRouter } from './routes/products';
import { ordersRouter } from './routes/orders';
import { settingsRouter } from './routes/settings';
import { uploadRouter, UPLOADS_DIR } from './routes/upload';
import { usersRouter } from './routes/users';
import { heroSlidesRouter } from './routes/hero-slides';
import { checkoutRouter } from './routes/checkout';
import { shippingRouter } from './routes/shipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);
app.use('/api/hero-slides', heroSlidesRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/shipping', shippingRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Serve o build do Angular (client/dist/client/browser) e faz fallback de SPA
// para qualquer rota que não seja /api ou /uploads.
const clientDist = path.join(__dirname, '..', 'client', 'dist', 'client', 'browser');
app.use(express.static(clientDist));
app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Build do client não encontrado. Rode "npm run build" primeiro.');
  });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno do servidor.' });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Aplicação rodando em http://localhost:${PORT}`);
});
