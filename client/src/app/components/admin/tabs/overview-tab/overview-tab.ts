import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { ApiService } from '../../../../services/api.service';
import { ApiError } from '../../../../services/api-error';
import { OverviewResponse } from '../../../../types/report';
import { barGeometry } from '../../../../utils/chart';

const PERIODS = [7, 30, 90];
const CHART_W = 640;
const CHART_H = 160;

@Component({
  selector: 'app-overview-tab',
  imports: [LucideAngularModule],
  templateUrl: './overview-tab.html',
})
export class OverviewTab implements OnInit {
  private api = inject(ApiService);

  /** Pede ao painel para abrir a aba de estoque. */
  goToStock = output<void>();

  readonly TriangleAlert = TriangleAlert;
  readonly periods = PERIODS;
  readonly chartW = CHART_W;
  readonly chartH = CHART_H;

  days = signal(30);
  data = signal<OverviewResponse | null>(null);
  loading = signal(true);
  error = signal('');

  readonly bars = computed(() => {
    const series = this.data()?.overview.series ?? [];
    return barGeometry(series.map((p) => p.revenue), CHART_W, CHART_H);
  });
  readonly maxRevenue = computed(() => Math.max(0, ...(this.data()?.overview.series.map((p) => p.revenue) ?? [0])));

  ngOnInit(): void {
    void this.load();
  }

  async setPeriod(days: number): Promise<void> {
    this.days.set(days);
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await this.api.get<OverviewResponse>(`/reports/overview?days=${this.days()}`));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível carregar os números.');
    } finally {
      this.loading.set(false);
    }
  }

  money(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  shortDate(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }
}
