import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookSignatureInput {
  /** Chave secreta do webhook (painel do Mercado Pago → Webhooks). */
  secret: string;
  /** Cabeçalho `x-signature`: "ts=<número>,v1=<hex>". */
  signature: string | undefined;
  /** Cabeçalho `x-request-id`. */
  requestId: string | undefined;
  /** `data.id` que veio na URL da notificação. */
  dataId: string | undefined;
}

/**
 * Confere a assinatura de uma notificação do Mercado Pago: HMAC-SHA256 do texto
 * `id:<data.id em minúsculas>;request-id:<x-request-id>;ts:<ts>;` com a chave secreta.
 * Partes ausentes saem do texto. Nunca lança: qualquer problema vira `false`.
 */
export function verifyWebhookSignature({ secret, signature, requestId, dataId }: WebhookSignatureInput): boolean {
  if (!secret || !signature) return false;

  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of signature.split(',')) {
    const [key, value] = part.split('=', 2).map((s) => s?.trim());
    if (key === 'ts') ts = value;
    if (key === 'v1') v1 = value;
  }
  if (!ts || !v1) return false;

  const manifest =
    (dataId ? `id:${dataId.toLowerCase()};` : '') + (requestId ? `request-id:${requestId};` : '') + `ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(v1, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
