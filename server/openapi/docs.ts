import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { requireAdmin } from '../middleware/auth';
import { buildOpenApiDocument } from './spec';

/**
 * Fora de produção: Swagger UI em /api/docs e o JSON em /api/docs.json.
 * Em produção a interface não é montada e o JSON só é entregue a administradores.
 */
export function mountApiDocs(app: Express, nodeEnv: string | undefined): void {
  const document = buildOpenApiDocument();
  if (nodeEnv === 'production') {
    app.get('/api/docs.json', requireAdmin, (_req, res) => res.json(document));
    return;
  }
  app.get('/api/docs.json', (_req, res) => res.json(document));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: 'API Cabo Frio Outlet' }));
}
