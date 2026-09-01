// Server-side only. Reads TMDB_ACCESS_TOKEN from the server environment and
// keeps all TMDB authentication logic in one place. Never import this file
// from a "use client" component — process.env.TMDB_ACCESS_TOKEN must not
// reach the browser bundle.

import type {
  TMDBCompanyDetails,
  TMDBGenreListResponse,
  TMDBMovie,
  TMDBMovieDetails,
  TMDBPersonDetails,
  TMDBPersonMovieCreditsResponse,
  TMDBPopularMoviesResponse,
  TMDBWatchProvidersResponse,
} from "@/types/tmdb";
import { serializeDiscoverGenres, type GenreMatchMode } from "@/lib/movieSearch";
import { withTimeoutFallback } from "@/lib/timeout";
import { DEFAULT_WATCH_REGION } from "@/lib/watchProviders";
import {
  mergeLocalizedMoviePage,
  mergeLocalizedMovies,
  mergeLocalizedMovieText,
  moviePageNeedsEnglishFallback,
  needsEnglishMovieFallback,
} from "@/lib/tmdbLocalization";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
const THAI_LANGUAGE = "th-TH";
const ENGLISH_LANGUAGE = "en-US";
const ENGLISH_FALLBACK_TIMEOUT_MS = 1800;

export class TMDBError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "TMDBError";
  }
}

/** Server misconfiguration (e.g. missing token) — distinct from a failed TMDB call. */
export class TMDBConfigError extends TMDBError {
  constructor(message: string) {
    super(message);
    this.name = "TMDBConfigError";
  }
}

function getAccessToken(): string {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) {
    throw new TMDBConfigError("TMDB_ACCESS_TOKEN is not configured on the server.");
  }
  return token;
}

async function tmdbFetch<T>(
  path: string,
  searchParams: Record<string, string> = {},
  options: { revalidateSeconds?: number } = {},
): Promise<T> {
  const token = getAccessToken();

  const url = new URL(`${TMDB_API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      // Unset (default): no caching, matches every existing caller's
      // always-fresh behavior. Only opted into for data that's expensive to
      // fetch per-item and changes rarely, e.g. watch providers.
      ...(options.revalidateSeconds !== undefined
        ? { next: { revalidate: options.revalidateSeconds } }
        : {}),
    });
  } catch {
    // Network-level failure (DNS, connection refused, etc). Never include
    // the token or raw error details that might carry it.
    throw new TMDBError("Failed to reach TMDB (network request failed).");
  }

  if (response.status === 401) {
    throw new TMDBError("TMDB rejected the configured access token.", 401);
  }

  if (!response.ok) {
    throw new TMDBError(
      `TMDB request failed with status ${response.status}.`,
      response.status,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new TMDBError("TMDB returned a response that could not be parsed as JSON.");
  }

  if (!data || typeof data !== "object") {
    throw new TMDBError("TMDB returned an unexpected response shape.");
  }

  return data as T;
}

/** Popular rankings don't need per-request freshness - a short cache avoids
 *  forcing a fresh TMDB round-trip on every single /movies visit. */
const POPULAR_MOVIES_REVALIDATE_SECONDS = 90;
const DISCOVERY_REVALIDATE_SECONDS = 60 * 5;

async function fetchThaiFirstMoviePage(
  path: string,
  searchParams: Record<string, string>,
  options: { revalidateSeconds?: number } = {},
): Promise<TMDBPopularMoviesResponse> {
  const thai = await tmdbFetch<TMDBPopularMoviesResponse>(
    path,
    { ...searchParams, language: THAI_LANGUAGE },
    options,
  );
  if (!moviePageNeedsEnglishFallback(thai)) return thai;

  const english = await withTimeoutFallback(
    tmdbFetch<TMDBPopularMoviesResponse>(
      path,
      { ...searchParams, language: ENGLISH_LANGUAGE },
      options,
    ),
    ENGLISH_FALLBACK_TIMEOUT_MS,
    null,
  );
  // Thai data is still useful. A failed/slow optional fallback must not turn
  // a successful primary request into a failed or indefinitely stalled page.
  return mergeLocalizedMoviePage(thai, english);
}

/** Fetch TMDB's popular movies list, Thai first with bounded English fallback. */
export async function getPopularMovies(page = 1): Promise<TMDBPopularMoviesResponse> {
  return fetchThaiFirstMoviePage(
    "/movie/popular",
    { page: String(page) },
    { revalidateSeconds: POPULAR_MOVIES_REVALIDATE_SECONDS },
  );
}

/** Popular movies currently included with streaming access in Thailand. */
export async function getStreamingMovies(
  page = 1,
  region: string = DEFAULT_WATCH_REGION,
): Promise<TMDBPopularMoviesResponse> {
  return fetchThaiFirstMoviePage(
    "/discover/movie",
    {
      page: String(page),
      sort_by: "popularity.desc",
      watch_region: region,
      with_watch_monetization_types: "flatrate|free|ads",
    },
    { revalidateSeconds: DISCOVERY_REVALIDATE_SECONDS },
  );
}

/** Movies currently playing in cinemas, using Thailand's regional releases. */
export async function getNowPlayingMovies(
  page = 1,
  region: string = DEFAULT_WATCH_REGION,
): Promise<TMDBPopularMoviesResponse> {
  return fetchThaiFirstMoviePage(
    "/movie/now_playing",
    { page: String(page), region },
    { revalidateSeconds: DISCOVERY_REVALIDATE_SECONDS },
  );
}

/** Fetch TMDB's official movie genre list in Thai. Server-side only. */
export async function getMovieGenres(): Promise<TMDBGenreListResponse> {
  return tmdbFetch<TMDBGenreListResponse>("/genre/movie/list", {
    language: THAI_LANGUAGE,
  });
}

interface TMDBMovieDetailsResponse {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: { id: number; name: string }[];
  original_language: string;
  original_title: string;
  adult: boolean;
  video: boolean;
}

function detailsToMovie(details: TMDBMovieDetailsResponse): TMDBMovie {
  return {
    id: details.id,
    title: details.title,
    overview: details.overview,
    poster_path: details.poster_path,
    backdrop_path: details.backdrop_path,
    release_date: details.release_date,
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    popularity: details.popularity,
    genre_ids: details.genres.map((genre) => genre.id),
    original_language: details.original_language,
    original_title: details.original_title,
    adult: details.adult,
    video: details.video,
  };
}

/**
 * Fetch full details for one movie by TMDB ID, Thai first with English
 * fallback for missing display text. Server-side only.
 * Used to reconstruct movie cards from watched-state IDs — lib/watched.ts
 * only stores IDs, never full movie objects.
 */
export async function getMovieById(movieId: number): Promise<TMDBMovie> {
  const thai = await tmdbFetch<TMDBMovieDetailsResponse>(`/movie/${movieId}`, {
    language: THAI_LANGUAGE,
  });
  if (!needsEnglishMovieFallback(thai)) return detailsToMovie(thai);

  const english = await withTimeoutFallback(
    tmdbFetch<TMDBMovieDetailsResponse>(`/movie/${movieId}`, {
      language: ENGLISH_LANGUAGE,
    }),
    ENGLISH_FALLBACK_TIMEOUT_MS,
    null,
  );
  return detailsToMovie(mergeLocalizedMovieText(thai, english));
}

/**
 * Fetch details for multiple movies by ID. TMDB has no bulk-by-ID endpoint,
 * so this issues one request per ID. An individual failure (e.g. a
 * deleted/invalid id) is skipped rather than failing the whole batch -
 * unless every single lookup fails, which more likely indicates a systemic
 * problem (missing config, TMDB unreachable) and is surfaced as an error
 * instead of silently returning an empty list.
 */
export async function getMoviesByIds(movieIds: number[]): Promise<TMDBMovie[]> {
  if (movieIds.length === 0) return [];

  const results = await Promise.allSettled(movieIds.map((id) => getMovieById(id)));
  const fulfilled = results.filter(
    (r): r is PromiseFulfilledResult<TMDBMovie> => r.status === "fulfilled",
  );

  if (fulfilled.length === 0) {
    const firstRejection = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (firstRejection) throw firstRejection.reason;
  }

  return fulfilled.map((r) => r.value);
}

/**
 * Fetch full details for one movie, including genres (as objects), runtime,
 * production companies, top-level cast/crew, and keywords (via TMDB's
 * append_to_response=credits,keywords, so this is still a single request).
 * Used by the movie detail page and by favorite-derived taste extraction
 * (lib/recommendations-v2.ts). Server-side only.
 */
export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  const thai = await tmdbFetch<TMDBMovieDetails>(`/movie/${movieId}`, {
    language: THAI_LANGUAGE,
    append_to_response: "credits,keywords",
  });
  if (!needsEnglishMovieFallback(thai)) return thai;

  const english = await withTimeoutFallback(
    tmdbFetch<TMDBMovieDetailsResponse>(`/movie/${movieId}`, {
      language: ENGLISH_LANGUAGE,
    }),
    ENGLISH_FALLBACK_TIMEOUT_MS,
    null,
  );
  return mergeLocalizedMovieText(thai, english);
}

/** Fetch a person's profile (name, photo, known-for department, bio). Server-side only. */
export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails> {
  const thai = await tmdbFetch<TMDBPersonDetails>(`/person/${personId}`, {
    language: THAI_LANGUAGE,
  });
  if (thai.biography.trim()) return thai;
  const english = await withTimeoutFallback(
    tmdbFetch<TMDBPersonDetails>(`/person/${personId}`, {
      language: ENGLISH_LANGUAGE,
    }),
    ENGLISH_FALLBACK_TIMEOUT_MS,
    null,
  );
  return english ? { ...thai, biography: english.biography } : thai;
}

/**
 * Fetch a person's movie acting + crew credits. Used to build a person's
 * filmography on their profile page. Server-side only.
 */
export async function getPersonMovieCredits(
  personId: number,
): Promise<TMDBPersonMovieCreditsResponse> {
  const path = `/person/${personId}/movie_credits`;
  const thai = await tmdbFetch<TMDBPersonMovieCreditsResponse>(path, {
    language: THAI_LANGUAGE,
  });
  if (![...thai.cast, ...thai.crew].some(needsEnglishMovieFallback)) return thai;

  const english = await withTimeoutFallback(
    tmdbFetch<TMDBPersonMovieCreditsResponse>(path, {
      language: ENGLISH_LANGUAGE,
    }),
    ENGLISH_FALLBACK_TIMEOUT_MS,
    null,
  );
  if (!english) return thai;
  return {
    ...thai,
    cast: mergeLocalizedMovies(thai.cast, english.cast),
    crew: mergeLocalizedMovies(thai.crew, english.crew),
  };
}

/** Fetch a production company's profile (name, logo). Server-side only. */
export async function getCompanyDetails(companyId: number): Promise<TMDBCompanyDetails> {
  return tmdbFetch<TMDBCompanyDetails>(`/company/${companyId}`, {});
}

/**
 * Fetch movies associated with a production company, most popular first.
 * Used to build a company's movies page. Server-side only.
 */
export async function getMoviesByCompany(
  companyId: number,
  page = 1,
): Promise<TMDBPopularMoviesResponse> {
  return fetchThaiFirstMoviePage(
    "/discover/movie",
    {
      with_companies: String(companyId),
      page: String(page),
      sort_by: "popularity.desc",
    },
    { revalidateSeconds: DISCOVERY_REVALIDATE_SECONDS },
  );
}

/**
 * Fetch TMDB's own "recommendations" for a single movie (TMDB's algorithm,
 * not filtered by anything in this app). Server-side only. Used both for the
 * Movie Detail "หนังที่คุณอาจชอบ" section (Phase 4 Part 11) and as a
 * favorite-similarity signal in the recommendation engine
 * (lib/recommendations-v2.ts / app/api/recommendations/candidates).
 */
export async function getMovieRecommendations(
  movieId: number,
  page = 1,
): Promise<TMDBPopularMoviesResponse> {
  return fetchThaiFirstMoviePage(
    `/movie/${movieId}/recommendations`,
    { page: String(page) },
    { revalidateSeconds: DISCOVERY_REVALIDATE_SECONDS },
  );
}

export interface DiscoverMoviesParams {
  genreIds?: number[];
  /** Defaults to "any" to preserve recommendation-pool behavior. */
  genreMatch?: GenreMatchMode;
  directorId?: number;
  castId?: number;
  companyId?: number;
  /** v3 - keyword/theme-based discovery (Part 1/Part 6 "movie characteristics"). */
  keywordIds?: number[];
  /** Restricts candidates to subscription/free/ad-supported streaming in this region. */
  streamingRegion?: string;
  page?: number;
}

/**
 * Generic TMDB discover wrapper used by the recommendation engine to build
 * targeted candidate pools (by genre, director, cast, production company, or
 * keyword/theme - Phase 4 Part 3, extended for Discovery v3 Part 1). Kept
 * separate from getMoviesByCompany (which has its own established contract
 * and caller) rather than generalizing it in place. Server-side only.
 */
export async function discoverMovies(params: DiscoverMoviesParams): Promise<TMDBPopularMoviesResponse> {
  const searchParams: Record<string, string> = {
    sort_by: "popularity.desc",
    page: String(params.page ?? 1),
  };
  if (params.genreIds && params.genreIds.length > 0) {
    // Recommendation pools keep the historical OR default. Explicit search
    // surfaces can opt into AND so every chosen genre must be present.
    searchParams.with_genres = serializeDiscoverGenres(
      params.genreIds,
      params.genreMatch ?? "any",
    );
  }
  if (params.directorId !== undefined) {
    searchParams.with_crew = String(params.directorId);
  }
  if (params.castId !== undefined) {
    searchParams.with_cast = String(params.castId);
  }
  if (params.companyId !== undefined) {
    searchParams.with_companies = String(params.companyId);
  }
  if (params.keywordIds && params.keywordIds.length > 0) {
    searchParams.with_keywords = params.keywordIds.join("|");
  }
  if (params.streamingRegion) {
    searchParams.watch_region = params.streamingRegion;
    searchParams.with_watch_monetization_types = "flatrate|free|ads";
  }
  return fetchThaiFirstMoviePage(
    "/discover/movie",
    searchParams,
    { revalidateSeconds: DISCOVERY_REVALIDATE_SECONDS },
  );
}

/** Convenience wrapper for recommendation pools that must prefer streaming in Thailand. */
export async function discoverStreamingMovies(
  params: Omit<DiscoverMoviesParams, "streamingRegion">,
): Promise<TMDBPopularMoviesResponse> {
  return discoverMovies({ ...params, streamingRegion: DEFAULT_WATCH_REGION });
}

// Watch-provider catalogs (which service has a title, and in which region)
// change far less often than the data above, so these are cached via Next's
// fetch cache instead of refetched on every request.
const WATCH_PROVIDERS_REVALIDATE_SECONDS = 60 * 60 * 6; // 6 hours

/**
 * Fetch raw watch-provider data (all regions TMDB has) for one movie.
 * Server-side only. Shape it for display with summarizeWatchProviders from
 * lib/watchProviders.ts rather than reading `.results` directly.
 */
export async function getWatchProviders(movieId: number): Promise<TMDBWatchProvidersResponse> {
  return tmdbFetch<TMDBWatchProvidersResponse>(
    `/movie/${movieId}/watch/providers`,
    {},
    { revalidateSeconds: WATCH_PROVIDERS_REVALIDATE_SECONDS },
  );
}

/**
 * Fetch raw watch-provider data for multiple movies in parallel. TMDB has no
 * bulk endpoint for this. Unlike getMoviesByIds, an individual failure is
 * just omitted from the result (never throws) - one movie's missing
 * streaming info must never take down a whole grid; callers/UI already treat
 * a missing entry the same as "no providers found" for that movie.
 */
export async function getWatchProvidersForMovies(
  movieIds: number[],
): Promise<Record<number, TMDBWatchProvidersResponse>> {
  const uniqueIds = [...new Set(movieIds)];
  if (uniqueIds.length === 0) return {};

  const settled = await Promise.allSettled(
    uniqueIds.map(async (id) => [id, await getWatchProviders(id)] as const),
  );

  const byMovieId: Record<number, TMDBWatchProvidersResponse> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      const [id, providers] = result.value;
      byMovieId[id] = providers;
    }
  }
  return byMovieId;
}
