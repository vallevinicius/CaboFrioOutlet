import { Component, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, Lock, Plus, Pencil, Trash2 } from 'lucide-angular';
import { Level, SECTIONS, Section } from '../../../../../utils/permissions';
import { Role, StaffService } from '../../../../../services/staff.service';
import { ToastService } from '../../../../../services/toast.service';
import { ApiError } from '../../../../../services/api-error';

type Choice = 'none' | Level;

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'none', label: 'Nenhum' },
  { value: 'view', label: 'Ver' },
  { value: 'edit', label: 'Editar' },
];

function emptyDraft(): Record<Section, Choice> {
  return Object.fromEntries(SECTIONS.map((s) => [s.key, 'none'])) as Record<Section, Choice>;
}

@Component({
  selector: 'app-roles-panel',
  imports: [LucideAngularModule],
  templateUrl: './roles-panel.html',
})
export class RolesPanel {
  roles = input.required<Role[]>();
  /** Avisa o pai para recarregar a lista depois de criar, editar ou apagar. */
  changed = output<void>();

  readonly Lock = Lock;
  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly sections = SECTIONS;
  readonly choices = CHOICES;

  /** null = editor fechado; '' = perfil novo; id = editando. */
  editingId = signal<string | null>(null);
  name = signal('');
  draft = signal<Record<Section, Choice>>(emptyDraft());
  saving = signal(false);

  private staffService = inject(StaffService);
  private toastService = inject(ToastService);

  openNew(): void {
    this.editingId.set('');
    this.name.set('');
    this.draft.set(emptyDraft());
  }

  openEdit(role: Role): void {
    const draft = emptyDraft();
    for (const p of role.permissions) draft[p.section] = p.level;
    this.editingId.set(role.id);
    this.name.set(role.name);
    this.draft.set(draft);
  }

  close(): void {
    this.editingId.set(null);
  }

  setChoice(section: Section, value: Choice): void {
    this.draft.update((d) => ({ ...d, [section]: value }));
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const id = this.editingId();
    if (id === null) return;
    const permissions = this.sections
      .map((s) => ({ section: s.key, level: this.draft()[s.key] }))
      .filter((p): p is { section: Section; level: Level } => p.level !== 'none');

    this.saving.set(true);
    try {
      if (id === '') await this.staffService.createRole({ name: this.name(), permissions });
      else await this.staffService.updateRole(id, { name: this.name(), permissions });
      this.toastService.showToast(id === '' ? 'Perfil criado' : 'Perfil atualizado');
      this.close();
      this.changed.emit();
    } catch (err) {
      this.toastService.showToast('Não foi possível salvar o perfil', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.saving.set(false);
    }
  }

  remove(role: Role): void {
    this.toastService.showConfirm(
      `Apagar o perfil "${role.name}"?`,
      role.userCount > 0 ? `${role.userCount} usuário(s) usam este perfil e ele não poderá ser apagado.` : undefined,
      async () => {
        try {
          await this.staffService.deleteRole(role.id);
          this.toastService.showToast('Perfil apagado');
          this.changed.emit();
        } catch (err) {
          this.toastService.showToast('Não foi possível apagar', err instanceof ApiError ? err.message : undefined);
        }
      },
      { confirmLabel: 'Apagar' }
    );
  }

  summary(role: Role): string {
    if (role.permissions.length === 0) return 'Sem acesso a nenhuma tela';
    const labelOf = (s: Section) => this.sections.find((x) => x.key === s)?.label ?? s;
    return role.permissions.map((p) => `${labelOf(p.section)} (${p.level === 'edit' ? 'editar' : 'ver'})`).join(' · ');
  }
}
