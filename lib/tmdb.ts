// Server-side only. Reads TMDB_ACCESS_TOKEN from the server environment and
// keeps all TMDB authentication logic in one place. Never import this file
// from a "use client" component — process.env.TMDB_ACCESS_TOKEN must not
// reach the browser bundle.

import type { TMDBGenreListResponse, TMDBPopularMoviesResponse } from "@/types/tmdb";

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
