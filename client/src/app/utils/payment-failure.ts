export const DEFAULT_FAILURE_MESSAGE =
  'O banco ou o Mercado Pago não aprovou este pagamento. Tente outro cartão, pague com Pix ou fale com o banco do cartão.';

const SECURITY_MESSAGE = 'Por segurança, este pagamento não foi aprovado. Tente outro meio de pagamento, como o Pix.';

/** Motivo (`status_detail` do Mercado Pago) → texto para o cliente. Nunca mostra o código técnico. */
const MESSAGES: Record<string, string> = {
  cc_rejected_insufficient_amount: 'Saldo ou limite insuficiente no cartão. Tente outro cartão ou pague com Pix.',
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão e tente de novo.',
  cc_rejected_bad_filled_date: 'Confira a data de validade do cartão e tente de novo.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV) do cartão e tente de novo.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão e tente de novo.',
  cc_rejected_form_error: 'Confira os dados do cartão e tente de novo.',
  cc_rejected_call_for_authorize: 'O banco pede autorização para esta compra. Ligue para o banco do cartão para liberar ou use outro cartão.',
  cc_rejected_card_disabled: 'O cartão está inativo. Ative-o com o banco ou use outro cartão.',
  cc_rejected_duplicated_payment: 'Você já fez um pagamento igual há pouco. Confira seu e-mail antes de tentar de novo.',
  cc_rejected_max_attempts: 'Limite de tentativas atingido. Use outro cartão ou tente mais tarde.',
  cc_rejected_invalid_installments: 'O cartão não aceita esse número de parcelas. Escolha outro parcelamento.',
  cc_rejected_card_error: 'Não foi possível processar o cartão. Tente de novo ou use outro cartão.',
  // Não explicamos ao cliente que foi risco ou lista de bloqueio.
  cc_rejected_high_risk: SECURITY_MESSAGE,
  cc_rejected_blacklist: SECURITY_MESSAGE,
  expired: 'O tempo para pagar acabou. Faça o pedido de novo.',
};

export function describePaymentFailure(statusDetail: string | null | undefined): string {
  return (statusDetail && MESSAGES[statusDetail]) || DEFAULT_FAILURE_MESSAGE;
}
