import { Component, OnInit, input, signal } from '@angular/core';

@Component({
  selector: 'app-stock-input',
  templateUrl: './stock-input.html',
})
export class StockInput implements OnInit {
  value = input.required<number>();
  disabled = input(false);
  onCommit = input.required<(quantity: number) => Promise<void>>();

  draft = signal('');
  saving = signal(false);

  ngOnInit(): void {
    this.draft.set(String(this.value()));
  }

  onDraftChange(raw: string): void {
    this.draft.set(raw);
  }

  async commit(): Promise<void> {
    const quantity = Math.max(0, parseInt(this.draft(), 10) || 0);
    this.draft.set(String(quantity));
    if (quantity === this.value()) return;
    this.saving.set(true);
    try {
      await this.onCommit()(quantity);
    } finally {
      this.saving.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      (event.currentTarget as HTMLInputElement).blur();
    }
  }
}
