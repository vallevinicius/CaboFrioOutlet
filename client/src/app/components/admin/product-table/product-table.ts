import { Component, input, output } from '@angular/core';
import { AppImageDirective } from '../../../directives/app-image.directive';
import { LucideAngularModule, Pencil, Trash2 } from 'lucide-angular';
import { Product } from '../../../types/product';

function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

@Component({
  selector: 'app-product-table',
  imports: [AppImageDirective, LucideAngularModule],
  templateUrl: './product-table.html',
})
export class ProductTable {
  products = input.required<Product[]>();
  /** Sem permissão de editar: esconde editar e apagar. */
  readOnly = input(false);
  edit = output<Product>();
  delete = output<Product>();

  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly formatPrice = formatPrice;
}
