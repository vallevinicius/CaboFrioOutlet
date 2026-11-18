import { Component, computed, inject, input } from '@angular/core';
import { AppImageDirective } from '../../directives/app-image.directive';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { tileLayout } from '../../utils/category-tiles';

/** "Escolha o seu estilo": um quadro com foto por categoria ativa, na ordem do painel. */
@Component({
  selector: 'app-category-tiles',
  imports: [AppImageDirective, RouterLink],
  templateUrl: './category-tiles.html',
})
export class CategoryTiles {
  counts = input.required<Record<string, number>>();
  private categories = inject(CategoryService).categories;

  readonly tiles = computed(() => {
    const list = this.categories();
    return list.map((c, i) => ({ ...c, ...tileLayout(i, list.length) }));
  });
}
