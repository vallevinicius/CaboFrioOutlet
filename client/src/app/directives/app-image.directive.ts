import { Directive, computed, input } from '@angular/core';
import { ImageSize, optimizedImage } from '../utils/optimized-image';

/**
 * `<img [appImage]="url" imageSize="card">`: usa a versão WebP no tamanho certo para o lugar.
 * `sizes` diz ao navegador a largura que a foto ocupa (padrão: metade da tela no celular, um quarto no desktop).
 */
@Directive({
  selector: 'img[appImage]',
  host: {
    '[src]': 'image().src',
    '[attr.srcset]': 'image().srcset',
    '[attr.sizes]': 'image().srcset ? sizes() : null',
  },
})
export class AppImageDirective {
  appImage = input.required<string>();
  imageSize = input<ImageSize>('thumb');
  sizes = input('(min-width: 1024px) 25vw, 50vw');

  readonly image = computed(() => optimizedImage(this.appImage(), this.imageSize()));
}
