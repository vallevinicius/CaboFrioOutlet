import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppImageDirective } from '../../../../directives/app-image.directive';
import { LucideAngularModule, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Tags, ListTree, Check, X } from 'lucide-angular';
import { AdminCategory, AdminSubcategory } from '../../../../types/category';
import { CategoryService } from '../../../../services/category.service';
import { ToastService } from '../../../../services/toast.service';
import { AuthService } from '../../../../services/auth.service';
import { ApiError } from '../../../../services/api-error';
import { CategoryForm, CategoryFormValue } from '../../category-form/category-form';

/** Aba Categorias do painel: cria, edita, oculta, reordena e apaga categorias da loja. */
@Component({
  selector: 'app-categories-tab',
  imports: [AppImageDirective, LucideAngularModule, CategoryForm],
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
  readonly ListTree = ListTree;
  readonly Check = Check;
  readonly X = X;

  /** Categoria com a lista de subcategorias aberta. */
  openSubs = signal<string | null>(null);
  newSubName = signal('');
  /** Subcategoria sendo renomeada (id) e o texto do campo. */
  renaming = signal<string | null>(null);
  renameValue = signal('');

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

  toggleSubs(category: AdminCategory): void {
    this.openSubs.set(this.openSubs() === category.id ? null : category.id);
    this.newSubName.set('');
    this.renaming.set(null);
  }

  async addSub(category: AdminCategory, event: Event): Promise<void> {
    event.preventDefault();
    const name = this.newSubName().trim();
    if (!name) return;
    await this.run(async () => {
      await this.categoryService.createSub(category.id, name);
      this.newSubName.set('');
      this.toastService.showToast(`"${name}" criada em ${category.name}.`, 'Ela aparece no site quando tiver alguma peça.', { variant: 'success' });
    });
  }

  startRename(sub: AdminSubcategory): void {
    this.renaming.set(sub.id);
    this.renameValue.set(sub.name);
  }

  async saveRename(sub: AdminSubcategory, event: Event): Promise<void> {
    event.preventDefault();
    const name = this.renameValue().trim();
    if (!name || name === sub.name) {
      this.renaming.set(null);
      return;
    }
    await this.run(async () => {
      await this.categoryService.updateSub(sub.id, { name, active: sub.active });
      this.renaming.set(null);
    });
  }

  async toggleSub(sub: AdminSubcategory): Promise<void> {
    await this.run(() => this.categoryService.updateSub(sub.id, { name: sub.name, active: !sub.active }));
  }

  async moveSub(sub: AdminSubcategory, direction: 'up' | 'down'): Promise<void> {
    await this.run(() => this.categoryService.moveSub(sub.id, direction));
  }

  deleteSub(sub: AdminSubcategory): void {
    this.toastService.showConfirm(`Apagar a subcategoria "${sub.name}"?`, 'Essa ação não pode ser desfeita.', () =>
      this.run(async () => {
        await this.categoryService.removeSub(sub.id);
        this.toastService.showToast('Subcategoria apagada.');
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
