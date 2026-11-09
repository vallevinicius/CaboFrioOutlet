export interface GoogleReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface ReviewsPayload {
  configured: boolean;
  rating: number | null;
  total: number;
  mapsUrl: string | null;
  reviews: GoogleReview[];
}

export const EMPTY_REVIEWS: ReviewsPayload = {
  configured: false,
  rating: null,
  total: 0,
  mapsUrl: null,
  reviews: [],
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h: evita gastar cota da API a cada visita
const cache = new Map<string, { at: number; payload: ReviewsPayload }>();

interface PlacesResponse {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string };
  }[];
}

/** Converte a resposta da Places API (New) no formato público, descartando avaliações sem texto. */
export function mapPlacesResponse(data: PlacesResponse): ReviewsPayload {
  const reviews = (data.reviews ?? [])
    .map((r) => ({
      author: r.authorAttribution?.displayName?.trim() || 'Cliente Google',
      rating: Math.min(5, Math.max(0, Math.round(r.rating ?? 0))),
      text: (r.text?.text ?? r.originalText?.text ?? '').trim(),
      relativeTime: r.relativePublishTimeDescription ?? '',
    }))
    .filter((r) => r.text !== '' && r.rating > 0);
  return {
    configured: true,
    rating: typeof data.rating === 'number' ? data.rating : null,
    total: data.userRatingCount ?? 0,
    mapsUrl: data.googleMapsUri ?? null,
    reviews,
  };
}

/**
 * Busca avaliações do Google (Places API New). Sem chave de API ou Place ID,
 * devolve payload vazio e a loja simplesmente não mostra a seção.
 */
export async function fetchGoogleReviews(
  placeId: string,
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<ReviewsPayload> {
  if (!placeId || !apiKey) return EMPTY_REVIEWS;

  const cached = cache.get(placeId);
  if (cached && now() - cached.at < CACHE_TTL_MS) return cached.payload;

  try {
    const res = await fetchImpl(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri,reviews',
        'Accept-Language': 'pt-BR',
      },
    });
    if (!res.ok) {
      // A mensagem de erro do Google não contém a chave; ajuda a diagnosticar (API desativada, faturamento etc.).
      const detail = await res.text().catch(() => '');
      throw new Error(`Places API respondeu ${res.status}: ${detail.slice(0, 300)}`);
    }
    const payload = mapPlacesResponse((await res.json()) as PlacesResponse);
    cache.set(placeId, { at: now(), payload });
    return payload;
  } catch (err) {
    console.error('Falha ao buscar avaliações do Google:', err instanceof Error ? err.message : err);
    // Em erro, serve o último valor em cache (mesmo vencido) para a seção não sumir.
    return cached?.payload ?? EMPTY_REVIEWS;
  }
}

export function clearReviewsCache(): void {
  cache.clear();
}
