import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-brand-showcase',
  templateUrl: './brand-showcase.html',
})
export class BrandShowcase {
  settingsService = inject(SettingsService);

  private router = inject(Router);

  handleClick(brand: string): void {
    this.router.navigate(['/produtos'], { queryParams: { marca: brand } });
  }
}
