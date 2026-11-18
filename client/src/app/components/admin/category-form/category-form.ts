import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, X, Upload } from 'lucide-angular';
import { AdminCategory, CategoryInput } from '../../../types/category';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';
import { oversizeMessage, uploadErrorMessage } from '../../../utils/upload-error';
import { slugify } from '../../../utils/slug';

export type CategoryFormValue = CategoryInput & { active: boolean };

@Component({
  selector: 'app-category-form',
  imports: [LucideAngularModule],
  templateUrl: './category-form.html',
})
export class CategoryForm implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);

  readonly X = X;
  readonly Upload = Upload;

  category = input.required<AdminCategory | null>();
  formSubmit = output<CategoryFormValue>();
  formClose = output<void>();

  readonly isEditing = computed(() => Boolean(this.category()));

  name = signal('');
  intro = signal('');
  description = signal('');
  image = signal('');
  active = signal(true);
  uploading = signal(false);
  error = signal('');

  /** Endereço da página. Fixo depois de criada (não quebra links nem o Google). */
  readonly path = computed(() => {
    const existing = this.category();
    if (existing) return `/${existing.slug}`;
    const slug = slugify(this.name());
    return slug ? `/${slug}` : '';
  });

  ngOnInit(): void {
    const c = this.category();
    if (!c) return;
    this.name.set(c.name);
    this.intro.set(c.intro);
    this.description.set(c.description);
    this.image.set(c.image);
    this.active.set(c.active);
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const tooBig = oversizeMessage(file);
    if (tooBig) {
      this.toastService.showToast('Foto grande demais', tooBig, { durationMs: 10_000 });
      input.value = '';
      return;
    }
    this.uploading.set(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { url } = await this.api.post<{ url: string }>('/upload', formData);
      this.image.set(url);
    } catch (err) {
      this.toastService.showToast('Erro ao enviar a foto', uploadErrorMessage(err, file), { durationMs: 10_000 });
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  handleSubmit(event: Event): void {
    event.preventDefault();
    if (!this.name().trim()) {
      this.error.set('Informe o nome da categoria.');
      return;
    }
    if (!this.path()) {
      this.error.set('Escolha um nome com letras ou números.');
      return;
    }
    this.error.set('');
    this.formSubmit.emit({
      name: this.name().trim(),
      intro: this.intro().trim(),
      description: this.description().trim(),
      image: this.image(),
      active: this.active(),
    });
  }
}
