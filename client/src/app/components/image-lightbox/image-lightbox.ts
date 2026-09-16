import { Component, HostListener, input, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-image-lightbox',
  imports: [LucideAngularModule],
  templateUrl: './image-lightbox.html',
})
export class ImageLightbox {
  readonly X = X;

  image = input.required<string>();
  alt = input<string>('');
  close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
