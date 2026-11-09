import express, { Router } from 'express';
import jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'segredo-de-teste';

/** Monta um app Express só com o router em teste. */
export function appWith(path: string, router: Router) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
}

export function tokenFor(userId: string, isAdmin = false): string {
  return `Bearer ${jwt.sign({ sub: userId, isAdmin }, TEST_JWT_SECRET)}`;
}
