import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    env: { JWT_SECRET: 'segredo-de-teste' },
  },
});
