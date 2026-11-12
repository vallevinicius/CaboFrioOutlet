import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCategory } from '../../types/product';
import { pathForCategory } from '../../data/categories';

interface Tile {
  value: ProductCategory;
  label: string;
  image: string;
  alt: string;
  layout: string;
  titleSize: string;
}

const TILES: Tile[] = [
  { value: 'camisas', label: 'Camisas', image: 'placeholders/cat-camisas.jpg', alt: 'Homem de costas usando camiseta oversized estampada', layout: 'col-span-2 row-span-2', titleSize: 'text-5xl sm:text-6xl lg:text-8xl' },
  { value: 'calças', label: 'Calças', image: 'placeholders/cat-calcas.jpg', alt: 'Calça jeans rasgada em uso na rua', layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
  { value: 'bermudas', label: 'Bermudas', image: 'placeholders/cat-bermudas.jpg', alt: 'Bermuda jeans clara com detalhes desfiados', layout: 'col-span-1', titleSize: 'text-3xl sm:text-5xl' },
  { value: 'bonés', label: 'Bonés', image: 'placeholders/cat-bones.jpg', alt: 'Boné bege sobre fundo amarelo', layout: 'col-span-2', titleSize: 'text-4xl sm:text-6xl' },
];

@Component({
  selector: 'app-category-tiles',
  imports: [RouterLink],
  templateUrl: './category-tiles.html',
})
export class CategoryTiles {
  counts = input.required<Record<string, number>>();
  readonly tiles = TILES;
  readonly pathFor = pathForCategory;
}
