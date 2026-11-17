import { Router } from 'express';
import { requirePermission } from '../middleware/permissions.js';
import {
  buildAuthorizeUrl,
  connectWithCode,
  consumeState,
  createState,
  disconnect,
  getConnectionStatus,
  redirectUri,
} from '../services/melhor-envio-auth.js';

/** Conexão da loja com a Melhor Envio (OAuth), pelo painel em Configurações. */
export const melhorEnvioRouter = Router();

melhorEnvioRouter.get('/status', requirePermission('configuracoes', 'view'), async (_req, res) => {
  res.json({ ...(await getConnectionStatus()), redirectUri: redirectUri() });
});

// Devolve o link para o painel abrir; o state amarra o retorno a este clique de administrador.
melhorEnvioRouter.post('/connect', requirePermission('configuracoes', 'edit'), async (_req, res) => {
  const status = await getConnectionStatus();
  if (!status.configured) {
    // Diz exatamente o que falta, em vez de mandar um link que a Melhor Envio recusa com "invalid_client".
    const problems = [
      ...(status.missing.includes('credentials')
        ? ['As credenciais do app da Melhor Envio (Client ID e Client Secret) ainda não estão no .env do servidor.']
        : []),
      ...(status.missing.includes('siteUrl')
        ? ['Defina SITE_URL no .env do servidor com o endereço público da loja (ex.: https://cabofriooutlet.com.br) e reinicie.']
        : []),
    ];
    return res.status(409).json({ error: problems.join(' ') });
  }
  res.json({ url: buildAuthorizeUrl(status.sandbox, createState()) });
});

const first = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

// A Melhor Envio devolve o navegador para cá com ?code=...&state=... (sem token de login, por isso o
// state assinado é a prova de que o fluxo começou num clique de administrador).
melhorEnvioRouter.get('/callback', async (req, res) => {
  const state = first(req.query['state']);
  if (!state || !consumeState(state)) return res.redirect('/admin?frete=erro');

  if (req.query['error']) return res.redirect('/admin?frete=cancelado');

  const code = first(req.query['code']);
  if (!code) return res.redirect('/admin?frete=erro');

  try {
    await connectWithCode(code);
    res.redirect('/admin?frete=conectado');
  } catch (err) {
    console.error('[frete] falha ao conectar a Melhor Envio:', String(err));
    res.redirect('/admin?frete=erro');
  }
});

melhorEnvioRouter.delete('/', requirePermission('configuracoes', 'edit'), async (_req, res) => {
  await disconnect();
  res.status(204).end();
});
