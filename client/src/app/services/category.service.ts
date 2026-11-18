import { Injectable, computed, inject, signal } from '@angular/core';
import { AdminCategory, Category, CategoryInput } from '../types/category';
import { CategoryPage, findByPath, findBySlug, findByValue, pathForCategory, toCategoryPage } from '../data/categories';
import { ApiService } from './api.service';

/** Categorias da loja (aba Categorias do painel). O site usa só as ativas. */
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private api = inject(ApiService);

  private _categories = signal<Category[]>([]);
  private loaded: Promise<void>;

  /** Ativas, em ordem, no formato do site. */
  readonly categories = computed<CategoryPage[]>(() => this._categories().map(toCategoryPage));

  constructor() {
    this.loaded = this.refresh().catch(() => {
      // API indisponível: o site segue sem categorias nesta sessão
    });
  }

  /** Resolve quando a primeira carga terminar (com sucesso ou não). */
  ready(): Promise<void> {
    return this.loaded;
  }

  async refresh(): Promise<void> {
    this._categories.set(await this.api.get<Category[]>('/categories'));
  }

  byValue(value: string): CategoryPage | undefined {
    return findByValue(this.categories(), value);
  }

  bySlug(slug: string | undefined): CategoryPage | undefined {
    return findBySlug(this.categories(), slug);
  }

  byPath(path: string): CategoryPage | undefined {
    return findByPath(this.categories(), path);
  }

  pathFor(value: string): string {
    return pathForCategory(this.categories(), value);
  }

  // ── Painel ──

  listAll(): Promise<AdminCategory[]> {
    return this.api.get<AdminCategory[]>('/categories/all');
  }

  async create(input: CategoryInput): Promise<void> {
    await this.api.post('/categories', input);
    await this.refresh();
  }

  async update(id: string, input: CategoryInput & { active: boolean }): Promise<void> {
    await this.api.put(`/categories/${id}`, input);
    await this.refresh();
  }

  async move(id: string, direction: 'up' | 'down'): Promise<void> {
    await this.api.patch(`/categories/${id}/move`, { direction });
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await this.api.delete(`/categories/${id}`);
    await this.refresh();
  }
}
