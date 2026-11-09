import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule, X, Upload } from 'lucide-angular';
import { HeroSlide, HeroSlideInput } from '../../../types/hero-slide';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';
import { ApiError } from '../../../services/api-error';
import { bannerImageHint } from '../../../utils/image-hint';

@Component({
  selector: 'app-banner-form',
  imports: [LucideAngularModule],
  templateUrl: './banner-form.html',
})
export class BannerForm implements OnInit {
  private api = inject(ApiService);
  private toastService = inject(ToastService);

  readonly X = X;
  readonly Upload = Upload;

  slide = input.required<HeroSlide | null>();
  formSubmit = output<HeroSlideInput>();
  formClose = output<void>();

  readonly isEditing = computed(() => Boolean(this.slide()));

  eyebrow = signal('');
  title = signal('');
  highlight = signal('');
  subtitle = signal('');
  ctaLabel = signal('Ver Coleção');
  image = signal('');
  uploading = signal(false);
  error = signal('');

  ngOnInit(): void {
    const slide = this.slide();
    if (!slide) return;
    this.eyebrow.set(slide.eyebrow);
    this.title.set(slide.title);
    this.highlight.set(slide.highlight);
    this.subtitle.set(slide.subtitle);
    this.ctaLabel.set(slide.ctaLabel);
    this.image.set(slide.image);
  }

  async handleFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await this.warnIfImageIsWeak(file);
    this.uploading.set(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { url } = await this.api.post<{ url: string }>('/upload', formData);
      this.image.set(url);
    } catch (err) {
      this.toastService.showToast('Erro ao enviar imagem', err instanceof ApiError ? err.message : undefined);
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  /** Mede a foto escolhida e avisa (sem bloquear) se ela não for boa para o banner. */
  private async warnIfImageIsWeak(file: File): Promise<void> {
    try {
      const bitmap = await createImageBitmap(file);
      const hint = bannerImageHint(bitmap.width, bitmap.height);
      bitmap.close();
      if (hint) this.toastService.showToast('Dica para o banner', hint);
    } catch {
      // formato que o navegador não lê: o servidor valida o envio
    }
  }

  handleSubmit(event: Event): void {
    event.preventDefault();

    if (!this.image()) {
      this.error.set('Adicione uma imagem para o banner.');
      return;
    }
    if (!this.title().trim()) {
      this.error.set('Informe o título do banner.');
      return;
    }

    this.formSubmit.emit({
      image: this.image(),
      eyebrow: this.eyebrow().trim(),
      title: this.title().trim(),
      highlight: this.highlight().trim(),
      subtitle: this.subtitle().trim(),
      ctaLabel: this.ctaLabel().trim() || 'Ver Coleção',
    });
  }
}
