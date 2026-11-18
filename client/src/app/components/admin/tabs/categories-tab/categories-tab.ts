import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Tags } from 'lucide-angular';
import { AdminCategory } from '../../../../types/category';
import { CategoryService } from '../../../../services/category.service';
import { ToastService } from '../../../../services/toast.service';
import { AuthService } from '../../../../services/auth.service';
import { ApiError } from '../../../../services/api-error';
import { CategoryForm, CategoryFormValue } from '../../category-form/category-form';

/** Aba Categorias do painel: cria, edita, oculta, reordena e apaga categorias da loja. */
@Component({
  selector: 'app-categories-tab',
  imports: [LucideAngularModule, CategoryForm],
  templateUrl: './categories-tab.html',
})
export class CategoriesTab implements OnInit {
  private categoryService = inject(CategoryService);
  private toastService = inject(ToastService);
  private auth = inject(AuthService);

  /** Categorias usam a permissão de Produtos. */
  readonly canEdit = computed(() => this.auth.can('produtos', 'edit'));

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly ChevronUp = ChevronUp;
  readonly ChevronDown = ChevronDown;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Tags = Tags;

  categories = signal<AdminCategory[]>([]);
  loading = signal(true);
  busy = signal(false);
  formOpen = signal(false);
  editing = signal<AdminCategory | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.categories.set(await this.categoryService.listAll());
    } catch (err) {
      this.toastService.showToast('Erro ao carregar categorias', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.loading.set(false);
    }
  }

  openCreateForm(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEditForm(category: AdminCategory): void {
    this.editing.set(category);
    this.formOpen.set(true);
  }

  async handleSubmit(value: CategoryFormValue): Promise<void> {
    const editing = this.editing();
    try {
      if (editing) {
        await this.categoryService.update(editing.id, value);
        this.toastService.showToast('Categoria atualizada!', undefined, { variant: 'success' });
      } else {
        await this.categoryService.create(value);
        this.toastService.showToast('Categoria criada!', 'Ela já aparece no menu, na home e no atacado.', { variant: 'success' });
      }
      this.formOpen.set(false);
      await this.load();
    } catch (err) {
      this.toastService.showToast('Erro ao salvar categoria', err instanceof ApiError ? err.message : undefined, { durationMs: 8000 });
    }
  }

  async toggleActive(category: AdminCategory): Promise<void> {
    await this.run(async () => {
      const { name, intro, description, image } = category;
      await this.categoryService.update(category.id, { name, intro, description, image, active: !category.active });
      this.toastService.showToast(category.active ? `"${category.name}" oculta do site.` : `"${category.name}" de volta ao site.`);
    });
  }

  async handleMove(category: AdminCategory, direction: 'up' | 'down'): Promise<void> {
    await this.run(() => this.categoryService.move(category.id, direction));
  }

  handleDelete(category: AdminCategory): void {
    this.toastService.showConfirm(`Apagar a categoria "${category.name}"?`, 'Essa ação não pode ser desfeita.', () =>
      this.run(async () => {
        await this.categoryService.remove(category.id);
        this.toastService.showToast('Categoria apagada.');
      }),
    );
  }

  /** Executa uma ação, mostra o erro da API se houver e recarrega a lista. */
  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.toastService.showToast('Não foi possível concluir', err instanceof ApiError ? err.message : undefined, { durationMs: 8000 });
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }
}
