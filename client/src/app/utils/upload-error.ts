import { ApiError } from '../services/api-error';

/** Mesmo limite do servidor (server/routes/upload.ts). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const NETWORK_ERROR = 'Não foi possível enviar a foto. Verifique a internet e tente de novo.';

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Barra antes de enviar: evita esperar o upload inteiro no 4G só para ouvir "não". */
export function oversizeMessage(file: { size: number }): string | null {
  return file.size > MAX_UPLOAD_BYTES ? `A foto tem ${formatMb(file.size)} e o limite é 20 MB.` : null;
}

/** Explica em português por que a foto não foi enviada e o que fazer. */
export function uploadErrorMessage(err: unknown, file: { size: number }): string {
  if (!(err instanceof ApiError) || err.status === 0) return NETWORK_ERROR;
  // 413 sem o JSON da API = barrado antes de chegar nela (limite do Nginx em produção).
  if (err.status === 413 && err.message === 'Erro 413') {
    return (
      `A foto é grande demais para o servidor (${formatMb(file.size)}). ` +
      'Avise o responsável pelo site para aumentar o limite de upload (client_max_body_size do Nginx).'
    );
  }
  return err.message;
}
