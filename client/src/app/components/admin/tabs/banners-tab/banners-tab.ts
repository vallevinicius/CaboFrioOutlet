import { Component, computed, inject, signal } from '@angular/core';
import { AppImageDirective } from '../../../../directives/app-image.directive';
import { LucideAngularModule, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Image } from 'lucide-angular';
import { HeroSlide, HeroSlideInput } from '../../../../types/hero-slide';
import { HeroSlideService } from '../../../../services/hero-slide.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { BannerForm } from '../../banner-form/banner-form';
import { AuthService } from '../../../../services/auth.service';

@Component({
  selector: 'app-banners-tab',
  imports: [AppImageDirective, LucideAngularModule, BannerForm],
  templateUrl: './banners-tab.html',
})
export class BannersTab {
  private auth = inject(AuthService);
  /** Só "ver" na tela: os controles que gravam somem ou ficam desativados. */
  readonly canEdit = computed(() => this.auth.can('banners', 'edit'));
  heroSlideService = inject(HeroSlideService);
  private toastService = inject(ToastService);

  readonly Plus = Plus;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly ChevronUp = ChevronUp;
  readonly ChevronDown = ChevronDown;
  readonly Image = Image;

  formOpen = signal(false);
  editingSlide = signal<HeroSlide | null>(null);

  openCreateForm(): void {
    this.editingSlide.set(null);
    this.formOpen.set(true);
  }

  openEditForm(slide: HeroSlide): void {
    this.editingSlide.set(slide);
    this.formOpen.set(true);
  }

  async handleSubmit(input: HeroSlideInput): Promise<void> {
    try {
      const editing = this.editingSlide();
      if (editing) {
        await this.heroSlideService.updateSlide(editing.id, input);
        this.toastService.showToast('Banner atualizado!');
      } else {
        await this.heroSlideService.addSlide(input);
        this.toastService.showToast('Banner adicionado!');
      }
      this.formOpen.set(false);
    } catch (err) {
      this.toastService.showToast('Erro ao salvar banner', err instanceof ApiError ? err.message : undefined);
    }
  }

  handleDelete(slide: HeroSlide): void {
    this.toastService.showConfirm(`Remover o banner "${slide.title}"?`, 'Essa ação não pode ser desfeita.', async () => {
      try {
        await this.heroSlideService.deleteSlide(slide.id);
        this.toastService.showToast('Banner removido.');
      } catch (err) {
        this.toastService.showToast('Erro ao remover banner', err instanceof ApiError ? err.message : undefined);
      }
    });
  }

  async handleMove(slide: HeroSlide, direction: 'up' | 'down'): Promise<void> {
    try {
      await this.heroSlideService.moveSlide(slide.id, direction);
    } catch (err) {
      this.toastService.showToast('Erro ao reordenar', err instanceof ApiError ? err.message : undefined);
    }
  }
}
