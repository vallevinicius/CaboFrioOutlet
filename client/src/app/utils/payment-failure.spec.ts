import { describe, expect, it } from 'vitest';
import { DEFAULT_FAILURE_MESSAGE, describePaymentFailure } from './payment-failure';

describe('describePaymentFailure', () => {
  it.each([
    ['cc_rejected_insufficient_amount', /saldo|limite/i],
    ['cc_rejected_bad_filled_security_code', /código de segurança/i],
    ['cc_rejected_bad_filled_date', /validade/i],
    ['cc_rejected_bad_filled_card_number', /número do cartão/i],
    ['cc_rejected_call_for_authorize', /autoriza/i],
    ['cc_rejected_card_disabled', /inativo|ative/i],
    ['cc_rejected_duplicated_payment', /já fez um pagamento/i],
    ['cc_rejected_max_attempts', /tentativas/i],
    ['cc_rejected_invalid_installments', /parcel/i],
    ['expired', /tempo/i],
  ])('%s → mensagem específica', (code, pattern) => {
    expect(describePaymentFailure(code)).toMatch(pattern);
  });

  it('recusa genérica (cc_rejected_other_reason) sugere outro meio de pagamento', () => {
    const message = describePaymentFailure('cc_rejected_other_reason');
    expect(message).toBe(DEFAULT_FAILURE_MESSAGE);
    expect(message).toMatch(/outro cartão|Pix/i);
  });

  it('motivo desconhecido, vazio ou ausente cai na mensagem padrão', () => {
    expect(describePaymentFailure('codigo_novo_do_mp')).toBe(DEFAULT_FAILURE_MESSAGE);
    expect(describePaymentFailure('')).toBe(DEFAULT_FAILURE_MESSAGE);
    expect(describePaymentFailure(null)).toBe(DEFAULT_FAILURE_MESSAGE);
    expect(describePaymentFailure(undefined)).toBe(DEFAULT_FAILURE_MESSAGE);
  });

  it('risco e lista de bloqueio não revelam o motivo ao cliente', () => {
    for (const code of ['cc_rejected_high_risk', 'cc_rejected_blacklist']) {
      const message = describePaymentFailure(code);
      expect(message).not.toMatch(/risco|fraude|bloque|lista/i);
      expect(message).toMatch(/segurança/i);
    }
  });

  it('nunca devolve o código técnico ao cliente', () => {
    expect(describePaymentFailure('cc_rejected_other_reason')).not.toContain('cc_rejected');
    expect(describePaymentFailure('codigo_novo_do_mp')).not.toContain('codigo_novo');
  });
});
