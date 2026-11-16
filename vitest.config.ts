import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    env: {
      JWT_SECRET: 'segredo-de-teste',
      // Chave só dos testes (32 bytes em base64). A de produção fica no .env do servidor.
      DATA_ENCRYPTION_KEY: 'dGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtMTI=',
    },
  },
});
