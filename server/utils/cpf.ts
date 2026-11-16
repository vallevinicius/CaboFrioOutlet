export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidCpf(raw: string): boolean {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let check1 = (sum * 10) % 11;
  if (check1 === 10) check1 = 0;
  if (check1 !== parseInt(cpf[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let check2 = (sum * 10) % 11;
  if (check2 === 10) check2 = 0;
  return check2 === parseInt(cpf[10], 10);
}

/** Marcador que contas da equipe usavam antes (a coluna era única). Ainda pode existir em dados antigos. */
const STAFF_CPF_PREFIX = 'equipe-';

/** O marcador é detalhe interno: para o front, conta da equipe é só "sem CPF". */
export function publicCpf(cpf: string): string {
  return cpf.startsWith(STAFF_CPF_PREFIX) ? '' : cpf;
}
