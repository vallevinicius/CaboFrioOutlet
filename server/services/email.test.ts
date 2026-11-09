import { describe, expect, it, vi } from 'vitest';
import { isValidEmail, sendEmail } from './email';

const msg = { to: 'cliente@exemplo.com', subject: 'Oi', html: '<p>oi</p>', text: 'oi', idempotencyKey: 'k1' };
const env = { apiKey: 're_secret', from: 'Loja <pedidos@loja.com.br>' };
const ok = (body: unknown = { id: 'em_1' }) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('sendEmail', () => {
  it('sem chave ou remetente não chama a Resend', async () => {
    const f = vi.fn();
    expect(await sendEmail(msg, { apiKey: undefined, from: env.from }, f as never)).toEqual({
      sent: false,
      reason: 'Resend não configurado',
    });
    expect(await sendEmail(msg, { apiKey: env.apiKey, from: '' }, f as never)).toMatchObject({ sent: false });
    expect(f).not.toHaveBeenCalled();
  });

  it('rejeita destinatário inválido ou com quebra de linha (injeção de cabeçalho)', async () => {
    const f = vi.fn();
    expect(await sendEmail({ ...msg, to: 'sem-arroba' }, env, f as never)).toMatchObject({ sent: false });
    expect(await sendEmail({ ...msg, to: 'a@b.com\nBcc: x@y.com' }, env, f as never)).toMatchObject({ sent: false });
    expect(f).not.toHaveBeenCalled();
  });

  it('envia com Bearer, remetente, destinatário e Idempotency-Key', async () => {
    const f = vi.fn().mockResolvedValue(ok());
    const result = await sendEmail(msg, env, f as never);
    expect(result).toEqual({ sent: true, id: 'em_1' });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_secret');
    expect(init.headers['Idempotency-Key']).toBe('k1');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: env.from, to: ['cliente@exemplo.com'], subject: 'Oi' });
  });

  it('erro da API ou de rede devolve sent:false sem lançar nem vazar a chave', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'invalid from' } as Response);
    expect(await sendEmail(msg, env, bad as never)).toEqual({ sent: false, reason: 'Resend 422' });
    const boom = vi.fn().mockRejectedValue(new Error('rede'));
    expect(await sendEmail(msg, env, boom as never)).toEqual({ sent: false, reason: 'Erro de rede' });
    expect(JSON.stringify(spy.mock.calls)).not.toContain('re_secret');
  });
});

describe('isValidEmail', () => {
  it('valida formato básico', () => {
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@b.com`)).toBe(false);
  });
});
