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
} from "@/types/tmdb";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

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

/** Fetch TMDB's popular movies list (en-US). Server-side only. */
export async function getPopularMovies(page = 1): Promise<TMDBPopularMoviesResponse> {
  return tmdbFetch<TMDBPopularMoviesResponse>("/movie/popular", {
    language: "en-US",
    page: String(page),
  });
}

/** Fetch TMDB's official movie genre list (en-US). Server-side only. */
export async function getMovieGenres(): Promise<TMDBGenreListResponse> {
  return tmdbFetch<TMDBGenreListResponse>("/genre/movie/list", {
    language: "en-US",
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
 * Fetch full details for one movie by TMDB ID (en-US). Server-side only.
 * Used to reconstruct movie cards from watched-state IDs — lib/watched.ts
 * only stores IDs, never full movie objects.
 */
export async function getMovieById(movieId: number): Promise<TMDBMovie> {
  const details = await tmdbFetch<TMDBMovieDetailsResponse>(`/movie/${movieId}`, {
    language: "en-US",
  });
  return detailsToMovie(details);
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
 * production companies, and top-level cast/crew (via TMDB's
 * append_to_response=credits, so this is a single request). Used by the
 * movie detail page. Server-side only.
 */
export async function getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${movieId}`, {
    language: "en-US",
    append_to_response: "credits",
  });
}

/** Fetch a person's profile (name, photo, known-for department, bio). Server-side only. */
export async function getPersonDetails(personId: number): Promise<TMDBPersonDetails> {
  return tmdbFetch<TMDBPersonDetails>(`/person/${personId}`, {
    language: "en-US",
  });
}

/**
 * Fetch a person's movie acting + crew credits. Used to build a person's
 * filmography on their profile page. Server-side only.
 */
export async function getPersonMovieCredits(
  personId: number,
): Promise<TMDBPersonMovieCreditsResponse> {
  return tmdbFetch<TMDBPersonMovieCreditsResponse>(`/person/${personId}/movie_credits`, {
    language: "en-US",
  });
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
  return tmdbFetch<TMDBPopularMoviesResponse>("/discover/movie", {
    with_companies: String(companyId),
    language: "en-US",
    page: String(page),
    sort_by: "popularity.desc",
  });
}
