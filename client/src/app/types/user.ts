import type { Permissions } from '../utils/permissions';

export interface CustomerProfile {
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
  /** Só vêm preenchidos na sessão (login e /auth/me). */
  isSuperAdmin?: boolean;
  permissions?: Permissions;
  createdAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface ProfileInput {
  name: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}
