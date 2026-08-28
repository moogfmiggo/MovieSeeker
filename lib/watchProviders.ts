import type { TMDBWatchProvider, TMDBWatchProvidersResponse } from "@/types/tmdb";

/** Thailand is the only region MovieSeeker supports as of Phase 2. */
export const DEFAULT_WATCH_REGION = "TH";

export interface WatchProviderSummary {
  region: string;
  /** TMDB-hosted watch page for this title/region, for "more info" / attribution. */
  link: string | null;
  /** Subscription (flatrate), free, and ad-supported offers merged - all "watch now, no per-title payment". */
  streaming: TMDBWatchProvider[];
  rent: TMDBWatchProvider[];
  buy: TMDBWatchProvider[];
  hasAny: boolean;
}

function dedupeByProvider(...lists: (TMDBWatchProvider[] | undefined)[]): TMDBWatchProvider[] {
  const byId = new Map<number, TMDBWatchProvider>();
  for (const list of lists) {
    for (const provider of list ?? []) {
      if (!byId.has(provider.provider_id)) {
        byId.set(provider.provider_id, provider);
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.display_priority - b.display_priority);
}

/**
 * Shapes one movie's raw TMDB watch-provider response into a single region's
 * Streaming / Rent / Buy summary. Pure - no fetching, never throws. Missing,
 * malformed, or region-less input all produce a valid empty summary
 * (hasAny: false), since "no streaming info for this movie" is an expected,
 * normal state, not an error.
 */
export function summarizeWatchProviders(
  response: TMDBWatchProvidersResponse | null | undefined,
  region: string = DEFAULT_WATCH_REGION,
): WatchProviderSummary {
  const regionData = response?.results?.[region];
  const streaming = dedupeByProvider(regionData?.flatrate, regionData?.free, regionData?.ads);
  const rent = dedupeByProvider(regionData?.rent);
  const buy = dedupeByProvider(regionData?.buy);

  return {
    region,
    link: regionData?.link ?? null,
    streaming,
    rent,
    buy,
    hasAny: streaming.length > 0 || rent.length > 0 || buy.length > 0,
  };
}

/** Batch form of summarizeWatchProviders, keyed by movie id - for grids/lists. */
export function summarizeWatchProvidersByMovie(
  responsesByMovieId: Record<number, TMDBWatchProvidersResponse | undefined>,
  region: string = DEFAULT_WATCH_REGION,
): Record<number, WatchProviderSummary> {
  const summaries: Record<number, WatchProviderSummary> = {};
  for (const [movieId, response] of Object.entries(responsesByMovieId)) {
    summaries[Number(movieId)] = summarizeWatchProviders(response, region);
  }
  return summaries;
}

/**
 * A capped, priority-ordered list of providers for compact display (e.g. a
 * MovieCard badge row) - streaming first, falling back to rent then buy only
 * if there's no streaming offer, so a card never looks empty when the movie
 * is at least available to rent or buy. Returns the visible providers plus
 * how many more exist beyond the cap.
 */
export function topProvidersForCard(
  summary: WatchProviderSummary,
  limit: number = 3,
): { visible: TMDBWatchProvider[]; moreCount: number } {
  const ordered =
    summary.streaming.length > 0
      ? summary.streaming
      : summary.rent.length > 0
        ? summary.rent
        : summary.buy;

  return {
    visible: ordered.slice(0, limit),
    moreCount: Math.max(0, ordered.length - limit),
  };
}
