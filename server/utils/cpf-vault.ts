import { blindIndex, decryptField, encryptField } from './crypto-field.js';
import { normalizeCpf, publicCpf } from './cpf.js';

/**
 * CPF no banco: `cpf` guarda o texto cifrado (AES-256-GCM) e `cpfHash` o carimbo (HMAC) que
 * mantém a unicidade ("já existe uma conta com esse CPF") sem revelar o número.
 */
export interface SealedCpf {
  cpf: string;
  cpfHash: string;
}

export function sealCpf(rawCpf: string): SealedCpf {
  const digits = normalizeCpf(rawCpf);
  return { cpf: encryptField(digits), cpfHash: blindIndex(digits) };
}

/**
 * Valor gravado → só os números do CPF ('' se não houver). Aceita dado antigo em texto puro e esconde
 * o marcador interno que contas da equipe tinham antes.
 */
export function openCpf(stored: string | null | undefined): string {
  if (!stored) return '';
  return publicCpf(decryptField(stored));
}
