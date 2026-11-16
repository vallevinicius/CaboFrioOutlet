/** Monta o link wa.me. Retorna null se não houver número válido configurado. */
export function whatsappUrl(number: string, message = ''): string | null {
  const digits = number.replace(/\D/g, '');
  if (digits.length < 12 || digits.length > 13) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

/** Exibe 5522999991234 como (22) 99999-1234. */
export function formatWhatsappDisplay(number: string): string {
  const digits = number.replace(/\D/g, '');
  const national = digits.startsWith('55') ? digits.slice(2) : digits;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return number;
}

/**
 * Telefone do cliente (com ou sem máscara) → número para o wa.me, com o 55 do Brasil.
 * Devolve null se não parecer um telefone: nesse caso a tela não mostra o botão.
 */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) return digits;
  return null;
}

/** Link do WhatsApp para a loja falar com o cliente sobre um pedido (mensagem já escrita). */
export function orderWhatsappUrl(
  phone: string | null | undefined,
  customerName: string,
  orderCode: string,
  storeName: string,
): string | null {
  const number = toWhatsappNumber(phone);
  if (!number) return null;
  const firstName = customerName.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Olá, ${firstName}!` : 'Olá!';
  return whatsappUrl(number, `${greeting} Aqui é da ${storeName}. Estou entrando em contato sobre o seu pedido #${orderCode}.`);
}
