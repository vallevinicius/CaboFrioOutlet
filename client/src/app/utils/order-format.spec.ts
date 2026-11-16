import { describe, expect, it } from 'vitest';
import { formatPaymentStatus } from './order-format';

describe('formatPaymentStatus', () => {
  it.each([
    ['processed', 'Aprovado'],
    ['failed', 'Recusado'],
    ['cancelled', 'Cancelado'],
    ['processing', 'Em análise'],
    ['action_required', 'Aguardando o pagamento'],
    ['expired', 'Expirado'],
  ])('%s → %s', (status, label) => {
    expect(formatPaymentStatus(status)).toBe(label);
  });
  it('sem status: nenhum pagamento foi iniciado', () => {
    expect(formatPaymentStatus(null)).toBe('Sem pagamento iniciado');
    expect(formatPaymentStatus(undefined)).toBe('Sem pagamento iniciado');
    expect(formatPaymentStatus('')).toBe('Sem pagamento iniciado');
  });
  it('status desconhecido aparece como veio (não esconde informação)', () => {
    expect(formatPaymentStatus('novo_status')).toBe('novo_status');
  });
});
