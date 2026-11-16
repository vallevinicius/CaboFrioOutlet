import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { CustomerProfile, ProfileInput, RegisterInput } from '../types/user';
import { clearToken, getToken, setToken } from './token';
import { Level, Section, canAccess } from '../utils/permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);

  private _user = signal<CustomerProfile | null>(null);
  private _checking = signal(true);

  readonly user = this._user.asReadonly();
  readonly checking = this._checking.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.isAdmin ?? false);
  readonly isSuperAdmin = computed(() => this._user()?.isSuperAdmin ?? false);

  /** Pode ver/editar a tela? O admin supremo pode tudo. */
  can(section: Section, level: Level): boolean {
    return this.isSuperAdmin() || canAccess(this._user()?.permissions, section, level);
  }

  /** Resolve assim que a checagem da sessão salva (se houver) terminar. */
  private readonly ready: Promise<void>;

  constructor() {
    const token = getToken();
    if (!token) {
      this._checking.set(false);
      this.ready = Promise.resolve();
      return;
    }
    this.ready = this.api
      .get<{ user: CustomerProfile }>('/auth/me')
      .then(({ user }) => this._user.set(user))
      .catch(() => clearToken())
      .finally(() => this._checking.set(false));
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  async login(email: string, password: string): Promise<void> {
    const { token, user } = await this.api.post<{ token: string; user: CustomerProfile }>('/auth/login', {
      email,
      password,
    });
    setToken(token);
    this._user.set(user);
  }

  async register(input: RegisterInput): Promise<void> {
    const { token, user } = await this.api.post<{ token: string; user: CustomerProfile }>(
      '/auth/register',
      input
    );
    setToken(token);
    this._user.set(user);
  }

  async updateProfile(input: ProfileInput): Promise<void> {
    const { user } = await this.api.put<{ user: CustomerProfile }>('/auth/me', input);
    this._user.set(user);
  }

  logout(): void {
    clearToken();
    this._user.set(null);
  }
}
