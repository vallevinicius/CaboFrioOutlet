import { describe, expect, it } from 'vitest';
import { describeConnection, freteNotice, type MelhorEnvioStatus } from './melhor-envio';

const status = (over: Partial<MelhorEnvioStatus> = {}): MelhorEnvioStatus => ({
  configured: true, connected: false, expiresAt: null, needsReconnect: false, sandbox: false,
  redirectUri: 'https://loja.com.br/api/shipping/melhor-envio/callback', ...over,
});

describe('describeConnection', () => {
  it('sem as credenciais do app no servidor: não configurado (não adianta clicar em conectar)', () => {
    expect(describeConnection(status({ configured: false })).state).toBe('nao-configurado');
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
    expect(describeConnection(status({ configured: false, connected: true })).state).toBe('nao-configurado');
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
