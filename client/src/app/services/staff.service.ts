import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Level, Section } from '../utils/permissions';

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  role: { id: string; name: string } | null;
  createdAt: string;
}

export interface RoleEntry {
  section: Section;
  level: Level;
}

export interface Role {
  id: string;
  name: string;
  /** Perfil de sistema (Administrador): somente leitura. */
  system: boolean;
  userCount: number;
  permissions: RoleEntry[];
}

export interface RoleInput {
  name: string;
  permissions: RoleEntry[];
}

export interface StaffInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export interface StaffUpdate {
  name?: string;
  roleId?: string;
  password?: string;
}

/** Equipe e perfis de acesso (só o admin supremo chama; o servidor confere de novo). */
@Injectable({ providedIn: 'root' })
export class StaffService {
  private api = inject(ApiService);

  listStaff(): Promise<StaffMember[]> {
    return this.api.get<StaffMember[]>('/staff');
  }
  createStaff(input: StaffInput): Promise<StaffMember> {
    return this.api.post<StaffMember>('/staff', input);
  }
  updateStaff(id: string, patch: StaffUpdate): Promise<StaffMember> {
    return this.api.patch<StaffMember>(`/staff/${id}`, patch);
  }
  removeStaff(id: string): Promise<void> {
    return this.api.delete<void>(`/staff/${id}`);
  }

  listRoles(): Promise<Role[]> {
    return this.api.get<Role[]>('/roles');
  }
  createRole(input: RoleInput): Promise<Role> {
    return this.api.post<Role>('/roles', input);
  }
  updateRole(id: string, input: RoleInput): Promise<Role> {
    return this.api.put<Role>(`/roles/${id}`, input);
  }
  deleteRole(id: string): Promise<void> {
    return this.api.delete<void>(`/roles/${id}`);
  }
}
