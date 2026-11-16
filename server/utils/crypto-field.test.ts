import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { blindIndex, decryptField, encryptField, loadKeys } from './crypto-field.js';

const keyOf = (bytes = 32) => randomBytes(bytes).toString('base64');

describe('loadKeys', () => {
  it('aceita 32 bytes em base64 ou em hexadecimal (64 caracteres)', () => {
    const raw = randomBytes(32);
    expect(() => loadKeys(raw.toString('base64'))).not.toThrow();
    expect(() => loadKeys(raw.toString('hex'))).not.toThrow();
    // a mesma chave dá as mesmas subchaves, qualquer que seja o formato
    expect(loadKeys(raw.toString('base64')).enc.equals(loadKeys(raw.toString('hex')).enc)).toBe(true);
  });
  it.each([[undefined], [''], ['curta'], [keyOf(16)], [keyOf(33)], ['x'.repeat(64)]])('recusa chave ausente ou inválida (%s)', (raw) => {
    expect(() => loadKeys(raw as string | undefined)).toThrow(/DATA_ENCRYPTION_KEY/);
  });
  it('a chave de criptografia e a do carimbo são diferentes entre si', () => {
    const keys = loadKeys(keyOf());
    expect(keys.enc.equals(keys.index)).toBe(false);
  });
});

describe('encryptField / decryptField', () => {
  it('ida e volta devolve o valor original', () => {
    for (const value of ['52998224725', '', 'ação com acentos ✓', 'x'.repeat(500)]) {
      expect(decryptField(encryptField(value))).toBe(value);
    }
  });
  it('o texto gravado é marcado, não contém o valor e muda a cada vez (IV aleatório)', () => {
    const a = encryptField('52998224725');
    const b = encryptField('52998224725');
    expect(a.startsWith('enc:v1:')).toBe(true);
    expect(a).not.toContain('52998224725');
    expect(a).not.toBe(b);
  });
  it('detecta adulteração do texto gravado', () => {
    const sealed = encryptField('52998224725');
    const parts = sealed.split(':');
    const ct = Buffer.from(parts[4], 'base64');
    ct[0] ^= 1;
    const tampered = [...parts.slice(0, 4), ct.toString('base64')].join(':');
    expect(() => decryptField(tampered)).toThrow();
  });
  it('com outra chave não decifra', () => {
    const other = loadKeys(keyOf());
    const sealed = encryptField('52998224725', other);
    expect(() => decryptField(sealed)).toThrow();
  });
  it('valor antigo, sem marca (ainda em texto puro), passa como está: dá para migrar sem parar o site', () => {
    expect(decryptField('52998224725')).toBe('52998224725');
    expect(decryptField('')).toBe('');
  });
  it('formato quebrado com a marca é erro, não texto', () => {
    expect(() => decryptField('enc:v1:so-uma-parte')).toThrow();
  });
});

describe('blindIndex', () => {
  it('é determinístico, tem 64 caracteres hexadecimais e diferencia valores', () => {
    const a = blindIndex('52998224725');
    expect(a).toBe(blindIndex('52998224725'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(blindIndex('39053344705')).not.toBe(a);
  });
  it('depende da chave: sem ela não dá para refazer o carimbo de um CPF (nem por força bruta)', () => {
    const other = loadKeys(keyOf());
    expect(blindIndex('52998224725', other)).not.toBe(blindIndex('52998224725'));
  });
});
