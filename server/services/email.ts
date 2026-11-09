export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Evita e-mail duplicado se a mesma operação for repetida (ex: webhook reenviado). */
  idempotencyKey?: string;
}

export type EmailResult = { sent: true; id?: string } | { sent: false; reason: string };

const RESEND_URL = 'https://api.resend.com/emails';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}

/**
 * Envia e-mail pela Resend. Nunca lança: falha de e-mail não pode derrubar
 * pagamento nem pedido. Sem RESEND_API_KEY/EMAIL_FROM, apenas pula o envio.
 */
export async function sendEmail(
  message: EmailMessage,
  env: { apiKey?: string; from?: string } = {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  },
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  if (!env.apiKey || !env.from) return { sent: false, reason: 'Resend não configurado' };
  if (!isValidEmail(message.to)) return { sent: false, reason: 'Destinatário inválido' };

  try {
    const res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
        ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: env.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Resend respondeu ${res.status}: ${detail.slice(0, 300)}`);
      return { sent: false, reason: `Resend ${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, id: data.id };
  } catch (err) {
    console.error('Falha ao enviar e-mail:', err instanceof Error ? err.message : err);
    return { sent: false, reason: 'Erro de rede' };
  }
}
