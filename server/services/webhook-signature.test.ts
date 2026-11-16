import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './webhook-signature.js';

const SECRET = 'segredo-de-teste-do-webhook';
const sign = (manifest: string, secret = SECRET) => createHmac('sha256', secret).update(manifest).digest('hex');
const header = (ts: string, v1: string) => `ts=${ts},v1=${v1}`;

describe('verifyWebhookSignature', () => {
  const dataId = 'ORD01ABC';
  const requestId = 'req-123';
  const ts = '1700000000';
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;

  it('aceita a assinatura correta (o id da query entra em minúsculas)', () => {
    expect(verifyWebhookSignature({ secret: SECRET, signature: header(ts, sign(manifest)), requestId, dataId })).toBe(true);
  });

  it('recusa quando o segredo é outro', () => {
    expect(verifyWebhookSignature({ secret: 'outro-segredo', signature: header(ts, sign(manifest)), requestId, dataId })).toBe(false);
  });

  it('recusa se qualquer parte assinada foi alterada (id, request-id ou ts)', () => {
    const signature = header(ts, sign(manifest));
    expect(verifyWebhookSignature({ secret: SECRET, signature, requestId, dataId: 'ORD01XYZ' })).toBe(false);
    expect(verifyWebhookSignature({ secret: SECRET, signature, requestId: 'req-999', dataId })).toBe(false);
    expect(verifyWebhookSignature({ secret: SECRET, signature: header('1700000001', sign(manifest)), requestId, dataId })).toBe(false);
  });

  it('sem x-request-id ou sem data.id, essas partes saem do texto assinado', () => {
    const noRequest = `id:${dataId.toLowerCase()};ts:${ts};`;
    expect(verifyWebhookSignature({ secret: SECRET, signature: header(ts, sign(noRequest)), requestId: undefined, dataId })).toBe(true);
    const noId = `request-id:${requestId};ts:${ts};`;
    expect(verifyWebhookSignature({ secret: SECRET, signature: header(ts, sign(noId)), requestId, dataId: undefined })).toBe(true);
  });

  it('cabeçalho ausente, vazio ou malformado é recusado (sem lançar erro)', () => {
    for (const signature of [undefined, '', 'lixo', 'ts=1700000000', 'v1=abc', 'ts=,v1=']) {
      expect(verifyWebhookSignature({ secret: SECRET, signature, requestId, dataId })).toBe(false);
    }
  });

  it('v1 com tamanho diferente do esperado é recusado (comparação segura, sem exceção)', () => {
    expect(verifyWebhookSignature({ secret: SECRET, signature: header(ts, 'abcd'), requestId, dataId })).toBe(false);
    expect(verifyWebhookSignature({ secret: SECRET, signature: header(ts, 'z'.repeat(64)), requestId, dataId })).toBe(false);
  });

  it('segredo vazio nunca valida', () => {
    expect(verifyWebhookSignature({ secret: '', signature: header(ts, sign(manifest, '')), requestId, dataId })).toBe(false);
  });
});
