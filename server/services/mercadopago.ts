const accessToken = process.env.MP_ACCESS_TOKEN;
const publicKey = process.env.MP_PUBLIC_KEY;

if (!accessToken) {
  throw new Error('MP_ACCESS_TOKEN não definido no .env');
}
if (!publicKey) {
  throw new Error('MP_PUBLIC_KEY não definido no .env');
}

export const MP_PUBLIC_KEY: string = publicKey;

const MP_API_BASE = 'https://api.mercadopago.com';

export interface MpApiResult<T> {
  ok: boolean;
  status: number;
  body: T;
}

// Chama a API da Mercado Pago diretamente via REST. Usado no lugar do SDK
// oficial porque, para a Orders API, o parser de erro do SDK descarta os
// detalhes da resposta (status_detail, dados do pedido) em respostas de
// pagamento recusado — a resposta crua da API traz tudo isso normalmente.
export async function mpFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<MpApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
  if (options.idempotencyKey) {
    headers['X-Idempotency-Key'] = options.idempotencyKey;
  }

  const res = await fetch(`${MP_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const body = (await res.json()) as T;
  return { ok: res.ok, status: res.status, body };
}
