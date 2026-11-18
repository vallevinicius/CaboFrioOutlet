import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { ProductService } from '../../services/product.service';
import { showcaseBrands } from '../../utils/brands';

@Component({
  selector: 'app-brand-showcase',
  templateUrl: './brand-showcase.html',
})
export class BrandShowcase {
  settingsService = inject(SettingsService);
  private productService = inject(ProductService);

  private router = inject(Router);

  /** Lista de Configurações; vazia, as marcas dos produtos do varejo. */
  readonly brands = computed(() =>
    showcaseBrands(this.settingsService.settings().brands, this.productService.retailProducts()),
  );

  handleClick(brand: string): void {
    this.router.navigate(['/produtos'], { queryParams: { marca: brand } });
  }
}
