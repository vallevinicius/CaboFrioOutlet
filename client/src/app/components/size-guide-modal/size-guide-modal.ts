import { Component, HostListener, output } from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { findInstitutionalPage, PageBlock } from '../../data/institutional-pages';

type TableBlock = Extract<PageBlock, { type: 'table' }>;

@Component({
  selector: 'app-size-guide-modal',
  imports: [LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-[80] bg-slate-900/60" (click)="close.emit()" aria-hidden="true"></div>
    <div
      class="fixed left-1/2 top-1/2 z-[90] max-h-[85vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-sm bg-white shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guia-medidas-titulo"
    >
      <div class="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
        <h2 id="guia-medidas-titulo" class="font-display text-xl font-semibold text-slate-900">Guia de medidas</h2>
        <button
          type="button"
          (click)="close.emit()"
          aria-label="Fechar guia de medidas"
          class="flex h-9 w-9 items-center justify-center rounded-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <lucide-icon [img]="X" class="h-5 w-5" />
        </button>
      </div>
      <div class="flex flex-col gap-5 p-5">
        <p class="text-sm text-slate-500">{{ intro }}</p>
        @for (table of tables; track table.caption) {
          <div class="overflow-x-auto rounded-sm border border-slate-200">
            <table class="w-full text-left text-sm">
              <caption class="border-b border-slate-200 bg-slate-50 px-4 py-3 text-left font-mono text-xs font-bold uppercase tracking-wider text-slate-900">
                {{ table.caption }}
              </caption>
              <thead class="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  @for (h of table.head; track h) {
                    <th scope="col" class="px-4 py-2 font-semibold">{{ h }}</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-slate-600">
                @for (row of table.rows; track $index) {
                  <tr>
                    @for (cell of row; track $index) {
                      <td class="px-4 py-2" [class.font-semibold]="$first" [class.text-slate-900]="$first">{{ cell }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class SizeGuideModal {
  close = output<void>();
  readonly X = X;

  private page = findInstitutionalPage('guia-de-medidas');
  readonly intro = this.page?.intro ?? '';
  readonly tables = (this.page?.blocks.filter((b): b is TableBlock => b.type === 'table') ?? []) as TableBlock[];

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close.emit();
  }
}
