import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { WholesaleQuote, WholesaleQuoteInput } from '../types/wholesale';

@Injectable({ providedIn: 'root' })
export class WholesaleService {
  private api = inject(ApiService);

  async submitQuote(input: WholesaleQuoteInput): Promise<void> {
    await this.api.post('/wholesale/quotes', input);
  }

  listQuotes(): Promise<WholesaleQuote[]> {
    return this.api.get<WholesaleQuote[]>('/wholesale/quotes');
  }

  setHandled(id: string, handled: boolean): Promise<WholesaleQuote> {
    return this.api.patch<WholesaleQuote>(`/wholesale/quotes/${id}`, { handled });
  }
}
