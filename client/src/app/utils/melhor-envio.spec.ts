import { describe, expect, it } from 'vitest';
import { describeConnection, freteNotice, type MelhorEnvioStatus } from './melhor-envio';

const status = (over: Partial<MelhorEnvioStatus> = {}): MelhorEnvioStatus => ({
  configured: true, missing: [], connected: false, expiresAt: null, needsReconnect: false, sandbox: false,
  redirectUri: 'https://loja.com.br/api/shipping/melhor-envio/callback', ...over,
});

describe('describeConnection', () => {
  it('sem as credenciais do app no servidor: não configurado (não adianta clicar em conectar)', () => {
    const d = describeConnection(status({ configured: false, missing: ['credentials'] }));
    expect(d.state).toBe('nao-configurado');
    expect(d.canConnect).toBe(false);
    expect(d.detail).toMatch(/credenciais|Client ID/i);
    expect(d.detail).not.toMatch(/SITE_URL/);
  });
  it('sem SITE_URL no servidor: diz exatamente isso (foi o que causou o "invalid_client")', () => {
    const d = describeConnection(status({ configured: false, missing: ['siteUrl'], redirectUri: null }));
    expect(d.state).toBe('nao-configurado');
    expect(d.canConnect).toBe(false);
    expect(d.detail).toMatch(/SITE_URL/);
    expect(d.detail).not.toMatch(/Client ID/i);
  });
  it('faltando as duas coisas, cita as duas', () => {
    const d = describeConnection(status({ configured: false, missing: ['credentials', 'siteUrl'], redirectUri: null }));
    expect(d.detail).toMatch(/SITE_URL/);
    expect(d.detail).toMatch(/Client ID/i);
  });
  it('credenciais ok mas sem conexão: desconectado, com a ação de conectar', () => {
    const d = describeConnection(status());
    expect(d.state).toBe('desconectado');
    expect(d.canConnect).toBe(true);
    expect(d.canDisconnect).toBe(false);
  });
  it('conectado: mostra até quando vale e permite reconectar e desconectar', () => {
    const d = describeConnection(status({ connected: true, expiresAt: '2026-12-16T12:00:00.000Z' }));
    expect(d.state).toBe('conectado');
    expect(d.canConnect).toBe(true);
    expect(d.canDisconnect).toBe(true);
    expect(d.detail).toMatch(/renova/i);
  });
  it('acesso vencido: pede para conectar de novo', () => {
    const d = describeConnection(status({ connected: true, needsReconnect: true, expiresAt: '2026-01-01T00:00:00.000Z' }));
    expect(d.state).toBe('reconectar');
    expect(d.canConnect).toBe(true);
  });
  it('credenciais ausentes vencem qualquer outro estado', () => {
    expect(describeConnection(status({ configured: false, missing: ['credentials'], connected: true })).state).toBe('nao-configurado');
  });
});

describe('freteNotice (volta da autorização, ?frete=...)', () => {
  it.each([
    ['conectado', 'Melhor Envio conectada'],
    ['cancelado', 'Autorização cancelada'],
    ['erro', 'Não foi possível conectar'],
  ])('%s → %s', (value, title) => {
    expect(freteNotice(value)?.title).toBe(title);
  });
  it('valor desconhecido ou ausente não mostra nada', () => {
    expect(freteNotice('qualquer')).toBeNull();
    expect(freteNotice(null)).toBeNull();
    expect(freteNotice('')).toBeNull();
  });
});
