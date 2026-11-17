/** Estado da conexão com a Melhor Envio, como o servidor devolve (nunca inclui os tokens). */
export interface MelhorEnvioStatus {
  /** O servidor está pronto para conectar: credenciais do app e SITE_URL no .env. */
  configured: boolean;
  /** O que falta no .env do servidor. */
  missing: ('credentials' | 'siteUrl')[];
  connected: boolean;
  expiresAt: string | null;
  needsReconnect: boolean;
  sandbox: boolean;
  /** Precisa ser idêntico ao cadastrado no app da Melhor Envio. Nulo quando falta o SITE_URL. */
  redirectUri: string | null;
}

export type ConnectionState = 'nao-configurado' | 'desconectado' | 'conectado' | 'reconectar';

export interface ConnectionView {
  state: ConnectionState;
  title: string;
  detail: string;
  canConnect: boolean;
  canDisconnect: boolean;
}

export function describeConnection(status: MelhorEnvioStatus): ConnectionView {
  if (!status.configured) {
    const problems = [
      ...(status.missing.includes('credentials') ? ['O Client ID e o Client Secret do app da Melhor Envio ainda não estão no .env do servidor.'] : []),
      ...(status.missing.includes('siteUrl') ? ['Falta a linha SITE_URL no .env do servidor, com o endereço da loja (ex.: SITE_URL=https://cabofriooutlet.com.br).'] : []),
    ];
    return {
      state: 'nao-configurado',
      title: 'Falta configurar o servidor',
      detail: problems.join(' '),
      canConnect: false,
      canDisconnect: false,
    };
  }
  if (!status.connected) {
    return {
      state: 'desconectado',
      title: 'Não conectado',
      detail: 'Conecte a sua conta da Melhor Envio para calcular o frete automaticamente. Enquanto isso vale o frete fixo.',
      canConnect: true,
      canDisconnect: false,
    };
  }
  if (status.needsReconnect) {
    return {
      state: 'reconectar',
      title: 'Conexão expirada',
      detail: 'A autorização venceu e não foi possível renovar. Conecte de novo. Enquanto isso vale o frete fixo.',
      canConnect: true,
      canDisconnect: true,
    };
  }
  const until = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : null;
  return {
    state: 'conectado',
    title: 'Conectado',
    detail: `O frete é calculado automaticamente. A autorização se renova sozinha${until ? ` (válida até ${until}, antes disso o servidor renova)` : ''}.`,
    canConnect: true,
    canDisconnect: true,
  };
}

/** Aviso mostrado quando o navegador volta da Melhor Envio (/admin?frete=...). */
export function freteNotice(value: string | null): { title: string; description: string } | null {
  switch (value) {
    case 'conectado':
      return { title: 'Melhor Envio conectada', description: 'O frete passa a ser calculado automaticamente no checkout.' };
    case 'cancelado':
      return { title: 'Autorização cancelada', description: 'Nada foi alterado. Você pode conectar de novo quando quiser.' };
    case 'erro':
      return { title: 'Não foi possível conectar', description: 'Tente de novo. Se continuar, confira o endereço de retorno e as credenciais do app.' };
    default:
      return null;
  }
}
