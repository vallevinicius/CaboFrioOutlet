import { describe, expect, it } from 'vitest';
import { ApiError } from '../services/api-error';
import { MAX_UPLOAD_BYTES, formatMb, oversizeMessage, uploadErrorMessage } from './upload-error';

const MB = 1024 * 1024;

describe('upload-error', () => {
  it('limite de 20 MB, igual ao do servidor', () => {
    expect(MAX_UPLOAD_BYTES).toBe(20 * MB);
  });

  it('formatMb usa uma casa e vírgula', () => {
    expect(formatMb(23.44 * MB)).toBe('23,4 MB');
    expect(formatMb(20 * MB)).toBe('20,0 MB');
  });

  it('oversizeMessage: 20 MB exatos passam, 1 byte a mais não', () => {
    expect(oversizeMessage({ size: 20 * MB })).toBeNull();
    expect(oversizeMessage({ size: 23.4 * MB })).toBe('A foto tem 23,4 MB e o limite é 20 MB.');
    expect(oversizeMessage({ size: 20 * MB + 1 })).toBe('A foto tem 20,0 MB e o limite é 20 MB.');
  });

  it('413 do Nginx (sem JSON da API) pede para aumentar o limite do servidor', () => {
    expect(uploadErrorMessage(new ApiError('Erro 413', 413), { size: 12.5 * MB })).toBe(
      'A foto é grande demais para o servidor (12,5 MB). Avise o responsável pelo site para aumentar o limite de upload (client_max_body_size do Nginx).',
    );
  });

  it('413 da própria API mantém a mensagem dela', () => {
    const msg = 'A foto tem mais de 20 MB. Tire a foto em resolução menor ou escolha outra imagem.';
    expect(uploadErrorMessage(new ApiError(msg, 413), { size: 21 * MB })).toBe(msg);
  });

  it('sem internet (status 0) ou erro desconhecido: mensagem de rede', () => {
    const rede = 'Não foi possível enviar a foto. Verifique a internet e tente de novo.';
    expect(uploadErrorMessage(new ApiError('Erro 0', 0), { size: MB })).toBe(rede);
    expect(uploadErrorMessage(new Error('x'), { size: MB })).toBe(rede);
  });

  it('outros erros da API mostram a mensagem da API', () => {
    expect(uploadErrorMessage(new ApiError('Envie apenas arquivos de imagem.', 400), { size: MB })).toBe(
      'Envie apenas arquivos de imagem.',
    );
  });
});
