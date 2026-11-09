import { Component, input } from '@angular/core';
import { Product } from '../../types/product';
import { ProductCard } from '../product-card/product-card';

@Component({
  selector: 'app-new-arrivals',
  imports: [ProductCard],
  templateUrl: './new-arrivals.html',
})
export class NewArrivals {
  products = input.required<Product[]>();
}
