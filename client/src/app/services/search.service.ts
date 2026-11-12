import { Injectable, signal } from '@angular/core';

/** Texto da busca do menu, compartilhado entre o menu e a página de listagem. */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private _query = signal('');
  readonly query = this._query.asReadonly();

  set(value: string): void {
    this._query.set(value);
  }

  clear(): void {
    this._query.set('');
  }
}
