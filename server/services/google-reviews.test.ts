import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_REVIEWS,
  clearReviewsCache,
  fetchGoogleReviews,
  mapPlacesResponse,
} from './google-reviews';

const PLACE = 'ChIJ-place-id-0001';
const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('mapPlacesResponse', () => {
  it('mapeia nota, total e avaliações, descartando as sem texto ou sem nota', () => {
    const out = mapPlacesResponse({
      rating: 4.8,
      userRatingCount: 120,
      googleMapsUri: 'https://maps.google.com/?cid=1',
      reviews: [
        { rating: 5, text: { text: ' Ótimo atendimento! ' }, authorAttribution: { displayName: 'Ana' }, relativePublishTimeDescription: 'há 2 meses' },
        { rating: 5, text: { text: '' }, authorAttribution: { displayName: 'Sem texto' } },
        { rating: 0, text: { text: 'sem nota' } },
        { rating: 4, originalText: { text: 'Boas peças' } },
      ],
    });
    expect(out.configured).toBe(true);
    expect(out.rating).toBe(4.8);
    expect(out.total).toBe(120);
    expect(out.reviews).toEqual([
      { author: 'Ana', rating: 5, text: 'Ótimo atendimento!', relativeTime: 'há 2 meses' },
      { author: 'Cliente Google', rating: 4, text: 'Boas peças', relativeTime: '' },
    ]);
  });
  it('lida com resposta vazia', () => {
    expect(mapPlacesResponse({})).toMatchObject({ rating: null, total: 0, reviews: [] });
  });
});

describe('fetchGoogleReviews', () => {
  beforeEach(() => clearReviewsCache());

  it('sem chave ou Place ID não chama a API', async () => {
    const f = vi.fn();
    expect(await fetchGoogleReviews('', 'key', f as never)).toEqual(EMPTY_REVIEWS);
    expect(await fetchGoogleReviews(PLACE, undefined, f as never)).toEqual(EMPTY_REVIEWS);
    expect(f).not.toHaveBeenCalled();
  });

  it('envia a chave no header (nunca na URL) e usa cache dentro do TTL', async () => {
    const f = vi.fn().mockResolvedValue(okResponse({ rating: 5, userRatingCount: 1, reviews: [] }));
    let t = 1_000;
    await fetchGoogleReviews(PLACE, 'SECRET', f as never, () => t);
    await fetchGoogleReviews(PLACE, 'SECRET', f as never, () => (t += 60_000));
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(String(url)).not.toContain('SECRET');
    expect(init.headers['X-Goog-Api-Key']).toBe('SECRET');
  });

  it('refaz a busca depois do TTL', async () => {
    const f = vi.fn().mockResolvedValue(okResponse({ rating: 5, reviews: [] }));
    await fetchGoogleReviews(PLACE, 'k', f as never, () => 0);
    await fetchGoogleReviews(PLACE, 'k', f as never, () => 7 * 60 * 60 * 1000);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('em erro sem cache devolve vazio; com cache vencido serve o último valor', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fail = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    expect(await fetchGoogleReviews(PLACE, 'k', fail as never, () => 0)).toEqual(EMPTY_REVIEWS);

    const good = vi.fn().mockResolvedValue(okResponse({ rating: 4.5, userRatingCount: 3, reviews: [] }));
    await fetchGoogleReviews(PLACE, 'k', good as never, () => 0);
    const stale = await fetchGoogleReviews(PLACE, 'k', fail as never, () => 7 * 60 * 60 * 1000);
    expect(stale.rating).toBe(4.5);
  });

  it('erro de rede não propaga', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boom = vi.fn().mockRejectedValue(new Error('rede'));
    expect(await fetchGoogleReviews(PLACE, 'k', boom as never)).toEqual(EMPTY_REVIEWS);
  });
});
