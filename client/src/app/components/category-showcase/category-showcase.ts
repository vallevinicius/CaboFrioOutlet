import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../../types/product';
import { ALL_PRODUCTS_PATH, CATEGORY_PAGES } from '../../data/categories';
import { totalStock } from '../../utils/product-list';
import { ProductCard } from '../product-card/product-card';

const PER_CATEGORY = 4;

/** Prévia de cada categoria na home: poucas peças e um link para a página completa. */
@Component({
  selector: 'app-category-showcase',
  imports: [RouterLink, ProductCard],
  templateUrl: './category-showcase.html',
})
export class CategoryShowcase {
  products = input.required<Product[]>();
  loading = input(false);

  readonly allPath = ALL_PRODUCTS_PATH;

  readonly sections = computed(() =>
    CATEGORY_PAGES.map((page) => ({
      page,
      items: this.products()
        .filter((p) => p.category === page.value && totalStock(p) > 0)
        .slice(0, PER_CATEGORY),
    })).filter((s) => s.items.length > 0),
  );
}
