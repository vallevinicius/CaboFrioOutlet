import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Criptografia de campos sensíveis (CPF) no próprio servidor: AES-256-GCM com IV aleatório.
 * O banco só guarda o texto cifrado; sem a chave (variável DATA_ENCRYPTION_KEY, só no servidor)
 * quem ler o banco não consegue recuperar o valor. Perder a chave = perder os dados cifrados.
 */

export interface FieldKeys {
  /** Chave do AES-256-GCM. */
  enc: Buffer;
  /** Chave do carimbo (HMAC) usado só para barrar duplicidade e buscar sem revelar o valor. */
  index: Buffer;
}

const PREFIX = 'enc:v1:';
const KEY_HELP = 'Gere uma com: openssl rand -base64 32';

/** Lê a chave mestra (32 bytes em base64 ou 64 hex) e deriva duas chaves independentes (HKDF). */
export function loadKeys(raw: string | undefined): FieldKeys {
  const value = raw?.trim();
  if (!value) throw new Error(`DATA_ENCRYPTION_KEY não definida no .env. ${KEY_HELP}`);

  const isHex = /^[0-9a-fA-F]{64}$/.test(value);
  const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  const master = isHex ? Buffer.from(value, 'hex') : isBase64 ? Buffer.from(value, 'base64') : Buffer.alloc(0);
  if (master.length !== 32) {
    throw new Error(`DATA_ENCRYPTION_KEY inválida: precisa ter exatamente 32 bytes (base64 ou 64 caracteres hexadecimais). ${KEY_HELP}`);
  }

  const derive = (info: string) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
  return { enc: derive('cabofrio:field-encryption:v1'), index: derive('cabofrio:blind-index:v1') };
}

// Falha logo na subida se a chave estiver faltando ou errada (como o JWT_SECRET).
const KEYS = loadKeys(process.env.DATA_ENCRYPTION_KEY);

export function encryptField(plain: string, keys: FieldKeys = KEYS): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keys.enc, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decifra um valor gravado por `encryptField`. Valor sem a marca (dado antigo, ainda em texto puro)
 * é devolvido como está, para a migração dos dados existentes acontecer sem parar o site.
 */
export function decryptField(stored: string, keys: FieldKeys = KEYS): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const [iv, tag, ciphertext, ...extra] = stored.slice(PREFIX.length).split(':');
  if (!iv || !tag || ciphertext === undefined || extra.length > 0) throw new Error('Valor cifrado em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', keys.enc, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

/** Carimbo determinístico (HMAC-SHA256 com chave própria): permite unicidade e busca sem expor o valor. */
export function blindIndex(plain: string, keys: FieldKeys = KEYS): string {
  return createHmac('sha256', keys.index).update(plain).digest('hex');
}
