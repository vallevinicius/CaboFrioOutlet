import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideAngularModule, MessageCircle, Mail } from 'lucide-angular';
import { WholesaleService } from '../../../../services/wholesale.service';
import { ToastService } from '../../../../services/toast.service';
import { ApiError } from '../../../../services/api-error';
import { WholesaleQuote } from '../../../../types/wholesale';
import { formatCnpj } from '../../../../utils/cnpj';
import { whatsappUrl } from '../../../../utils/whatsapp';

@Component({
  selector: 'app-wholesale-tab',
  imports: [LucideAngularModule],
  templateUrl: './wholesale-tab.html',
})
export class WholesaleTab implements OnInit {
  private wholesale = inject(WholesaleService);
  private toast = inject(ToastService);

  readonly MessageCircle = MessageCircle;
  readonly Mail = Mail;
  readonly formatCnpj = formatCnpj;

  quotes = signal<WholesaleQuote[]>([]);
  loading = signal(true);
  error = signal('');

  readonly pending = computed(() => this.quotes().filter((q) => !q.handled).length);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.quotes.set(await this.wholesale.listQuotes());
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Não foi possível carregar os pedidos.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleHandled(quote: WholesaleQuote): Promise<void> {
    try {
      const updated = await this.wholesale.setHandled(quote.id, !quote.handled);
      this.quotes.update((list) => list.map((q) => (q.id === updated.id ? updated : q)));
    } catch (err) {
      this.toast.showToast('Não foi possível atualizar o pedido', err instanceof ApiError ? err.message : undefined);
    }
  }

  whatsapp(quote: WholesaleQuote): string | null {
    return whatsappUrl(quote.phone, `Olá, ${quote.name.split(' ')[0]}! Aqui é da loja, sobre o seu pedido de orçamento de atacado.`);
  }

  money(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
