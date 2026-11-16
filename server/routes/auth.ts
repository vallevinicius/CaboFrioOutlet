import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, JWT_SECRET } from '../middleware/auth.js';
import { isValidCpf, normalizeCpf } from '../utils/cpf.js';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UF_REGEX = /^[A-Za-z]{2}$/;

function issueToken(user: { id: string; isAdmin: boolean }): string {
  return jwt.sign({ sub: user.id, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '7d' });
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  isAdmin: boolean;
  createdAt: Date;
}) {
  const { passwordHash: _drop, ...rest } = user as typeof user & { passwordHash?: string };
  return rest;
}

interface RegisterPayload {
  name?: string;
  email?: string;
  password?: string;
  cpf?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

authRouter.post('/register', async (req, res) => {
  const body = req.body as RegisterPayload;
  const { name, email, password, phone, street, number, complement, neighborhood, city } = body;
  const cpf = body.cpf ? normalizeCpf(body.cpf) : '';
  const cep = body.cep ? body.cep.replace(/\D/g, '') : '';
  const state = body.state?.trim().toUpperCase() ?? '';

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Informe seu nome.' });
  }
  if (!email?.trim() || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  if (!isValidCpf(cpf)) {
    return res.status(400).json({ error: 'Informe um CPF válido.' });
  }
  if (!phone?.trim() || phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Informe um telefone válido.' });
  }
  if (!cep || cep.length !== 8) {
    return res.status(400).json({ error: 'Informe um CEP válido.' });
  }
  if (!street?.trim() || !number?.trim() || !neighborhood?.trim() || !city?.trim()) {
    return res.status(400).json({ error: 'Preencha o endereço completo.' });
  }
  if (!UF_REGEX.test(state)) {
    return res.status(400).json({ error: 'Informe a UF do estado (ex: RJ).' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        cpf,
        phone: phone.trim(),
        cep,
        street: street.trim(),
        number: number.trim(),
        complement: complement?.trim() || null,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state,
      },
    });
    const token = issueToken(user);
    res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const rawTarget = err.meta?.target;
      const target = Array.isArray(rawTarget) ? rawTarget.join(',') : String(rawTarget ?? '');
      if (target.includes('cpf')) {
        return res.status(409).json({ error: 'Já existe uma conta com esse CPF.' });
      }
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const token = issueToken(user);
  res.json({ token, user: serializeUser(user) });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
  res.json({ user: serializeUser(user) });
});

interface UpdateMePayload {
  name?: string;
  email?: string;
  phone?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

authRouter.put('/me', requireAuth, async (req, res) => {
  const body = req.body as UpdateMePayload;
  const cep = body.cep ? body.cep.replace(/\D/g, '') : '';
  const state = body.state?.trim().toUpperCase() ?? '';

  if (!body.name?.trim()) {
    return res.status(400).json({ error: 'Informe seu nome.' });
  }
  if (!body.email?.trim() || !EMAIL_REGEX.test(body.email.trim())) {
    return res.status(400).json({ error: 'Informe um e-mail válido.' });
  }
  if (!body.phone?.trim() || body.phone.replace(/\D/g, '').length < 10) {
    return res.status(400).json({ error: 'Informe um telefone válido.' });
  }
  if (!cep || cep.length !== 8) {
    return res.status(400).json({ error: 'Informe um CEP válido.' });
  }
  if (!body.street?.trim() || !body.number?.trim() || !body.neighborhood?.trim() || !body.city?.trim()) {
    return res.status(400).json({ error: 'Preencha o endereço completo.' });
  }
  if (!UF_REGEX.test(state)) {
    return res.status(400).json({ error: 'Informe a UF do estado (ex: RJ).' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user!.sub },
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        cep,
        street: body.street.trim(),
        number: body.number.trim(),
        complement: body.complement?.trim() || null,
        neighborhood: body.neighborhood.trim(),
        city: body.city.trim(),
        state,
      },
    });
    res.json({ user: serializeUser(user) });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
    }
    throw err;
  }
});
