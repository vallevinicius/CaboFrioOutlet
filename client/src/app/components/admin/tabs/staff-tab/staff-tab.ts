import { Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule, Eye, EyeOff, Pencil, Plus, ShieldCheck, UserMinus } from 'lucide-angular';
import { Role, StaffMember, StaffService } from '../../../../services/staff.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { RolesPanel } from './roles-panel/roles-panel';

@Component({
  selector: 'app-staff-tab',
  imports: [LucideAngularModule, RolesPanel],
  templateUrl: './staff-tab.html',
})
export class StaffTab implements OnInit {
  private staffService = inject(StaffService);
  private toastService = inject(ToastService);

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly UserMinus = UserMinus;
  readonly ShieldCheck = ShieldCheck;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;

  members = signal<StaffMember[]>([]);
  roles = signal<Role[]>([]);
  loading = signal(true);

  /** null = formulário fechado; '' = novo usuário; id = editando. */
  editingId = signal<string | null>(null);
  name = signal('');
  email = signal('');
  password = signal('');
  roleId = signal('');
  showPassword = signal(false);
  saving = signal(false);

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      const [members, roles] = await Promise.all([this.staffService.listStaff(), this.staffService.listRoles()]);
      this.members.set(members);
      this.roles.set(roles);
    } catch (err) {
      this.toastService.showToast('Erro ao carregar a equipe', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.loading.set(false);
    }
  }

  openNew(): void {
    this.editingId.set('');
    this.name.set('');
    this.email.set('');
    this.password.set('');
    this.roleId.set(this.roles().find((r) => !r.system)?.id ?? this.roles()[0]?.id ?? '');
    this.showPassword.set(false);
  }

  openEdit(member: StaffMember): void {
    this.editingId.set(member.id);
    this.name.set(member.name);
    this.email.set(member.email);
    this.password.set('');
    this.roleId.set(member.role?.id ?? '');
    this.showPassword.set(false);
  }

  close(): void {
    this.editingId.set(null);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const id = this.editingId();
    if (id === null) return;

    this.saving.set(true);
    try {
      if (id === '') {
        await this.staffService.createStaff({
          name: this.name(),
          email: this.email(),
          password: this.password(),
          roleId: this.roleId(),
        });
        this.toastService.showToast('Usuário criado', 'Passe a senha provisória para a pessoa entrar.');
      } else {
        await this.staffService.updateStaff(id, {
          name: this.name(),
          roleId: this.roleId(),
          ...(this.password() ? { password: this.password() } : {}),
        });
        this.toastService.showToast('Usuário atualizado');
      }
      this.close();
      await this.reload();
    } catch (err) {
      this.toastService.showToast('Não foi possível salvar', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.saving.set(false);
    }
  }

  removeAccess(member: StaffMember): void {
    this.toastService.showConfirm(
      `Remover o acesso de ${member.name}?`,
      'A pessoa deixa de entrar no painel. A conta de cliente continua existindo.',
      async () => {
        try {
          await this.staffService.removeStaff(member.id);
          this.toastService.showToast('Acesso removido');
          await this.reload();
        } catch (err) {
          this.toastService.showToast('Não foi possível remover', err instanceof ApiError ? err.message : undefined);
        }
      },
      { confirmLabel: 'Remover acesso' }
    );
  }
}
