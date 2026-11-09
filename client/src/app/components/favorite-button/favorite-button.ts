import { Component, computed, inject, input } from '@angular/core';
import { LucideAngularModule, Heart } from 'lucide-angular';
import { FavoritesService } from '../../services/favorites.service';

@Component({
  selector: 'app-favorite-button',
  imports: [LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="onClick($event)"
      [attr.aria-pressed]="active()"
      [attr.aria-label]="active() ? 'Remover dos favoritos' : 'Adicionar aos favoritos'"
      class="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-white"
    >
      <lucide-icon [img]="Heart" class="h-[18px] w-[18px]" [class.fill-red-500]="active()" [class.text-red-500]="active()" />
    </button>
  `,
})
export class FavoriteButton {
  private favorites = inject(FavoritesService);

  productId = input.required<string>();
  readonly Heart = Heart;
  readonly active = computed(() => this.favorites.ids().includes(this.productId()));

  onClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.favorites.toggle(this.productId());
  }
}
