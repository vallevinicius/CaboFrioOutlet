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
