import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule, Star } from 'lucide-angular';
import { ReviewsService } from '../../services/reviews.service';

@Component({
  selector: 'app-google-reviews',
  imports: [LucideAngularModule],
  templateUrl: './google-reviews.html',
})
export class GoogleReviews {
  private reviewsService = inject(ReviewsService);

  readonly Star = Star;
  readonly stars = [1, 2, 3, 4, 5];
  readonly data = this.reviewsService.data;
  readonly visible = computed(() => {
    const d = this.data();
    return !!d && d.configured && d.reviews.length > 0;
  });
  readonly ratingLabel = computed(() => (this.data()?.rating ?? 0).toFixed(1).replace('.', ','));
}
