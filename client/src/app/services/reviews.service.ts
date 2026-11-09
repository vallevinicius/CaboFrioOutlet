import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface ReviewsData {
  configured: boolean;
  rating: number | null;
  total: number;
  mapsUrl: string | null;
  reviews: GoogleReview[];
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private api = inject(ApiService);

  private _data = signal<ReviewsData | null>(null);
  readonly data = this._data.asReadonly();

  constructor() {
    this.api
      .get<ReviewsData>('/reviews')
      .then((data) => this._data.set(data))
      .catch(() => {
        // Sem avaliações: a seção simplesmente não aparece
      });
  }
}
