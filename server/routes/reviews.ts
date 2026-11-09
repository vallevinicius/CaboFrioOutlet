import { Router } from 'express';
import { prisma } from '../db';
import { fetchGoogleReviews, EMPTY_REVIEWS } from '../services/google-reviews';

export const reviewsRouter = Router();

reviewsRouter.get('/', async (_req, res) => {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    select: { googlePlaceId: true },
  });
  const payload = settings?.googlePlaceId
    ? await fetchGoogleReviews(settings.googlePlaceId, process.env.GOOGLE_PLACES_API_KEY)
    : EMPTY_REVIEWS;
  res.set('Cache-Control', 'public, max-age=900');
  res.json(payload);
});
