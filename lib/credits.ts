// Pure helpers for shaping TMDB credit data - no fetching, no side effects.
// Kept separate from lib/tmdb.ts (fetching) and page components (rendering)
// so this logic is independently testable (see credits.test.ts).

import type {
  TMDBCastMember,
  TMDBCrewMember,
  TMDBMovie,
  TMDBPersonMovieCastCredit,
  TMDBPersonMovieCrewCredit,
} from "@/types/tmdb";

const DIRECTOR_JOB = "Director";

/** Top-billed cast for a movie, sorted by TMDB's own billing order. */
export function topBilledCast(
  cast: readonly TMDBCastMember[] | null | undefined,
  limit = 12,
): TMDBCastMember[] {
  if (!Array.isArray(cast)) return [];
  return [...cast].sort((a, b) => a.order - b.order).slice(0, limit);
}

/** The director(s) credited on a single movie. */
export function movieDirectors(
  crew: readonly TMDBCrewMember[] | null | undefined,
): TMDBCrewMember[] {
  if (!Array.isArray(crew)) return [];
  return crew.filter((member) => member.job === DIRECTOR_JOB);
}

/** A person's own directing credits, out of their full crew credit list. */
export function filterDirectingCredits(
  crew: readonly TMDBPersonMovieCrewCredit[] | null | undefined,
): TMDBPersonMovieCrewCredit[] {
  if (!Array.isArray(crew)) return [];
  return crew.filter((credit) => credit.job === DIRECTOR_JOB);
}

/**
 * Merges a person's acting and directing credits into one deduped
 * filmography (one entry per movie - the acting credit wins if they both
 * acted in and directed it), sorted by release date descending. Movies with
 * no/invalid release date sort last, by id.
 */
export function mergeFilmography(
  castCredits: readonly TMDBPersonMovieCastCredit[] | null | undefined,
  directingCredits: readonly TMDBPersonMovieCrewCredit[] | null | undefined,
): TMDBMovie[] {
  const byId = new Map<number, TMDBMovie>();
  for (const credit of Array.isArray(castCredits) ? castCredits : []) {
    if (!byId.has(credit.id)) byId.set(credit.id, credit);
  }
  for (const credit of Array.isArray(directingCredits) ? directingCredits : []) {
    if (!byId.has(credit.id)) byId.set(credit.id, credit);
  }
  return [...byId.values()].sort((a, b) => {
    const timeA = a.release_date ? Date.parse(a.release_date) : NaN;
    const timeB = b.release_date ? Date.parse(b.release_date) : NaN;
    const validA = Number.isFinite(timeA);
    const validB = Number.isFinite(timeB);
    if (validA && validB) return timeB - timeA;
    if (validA) return -1;
    if (validB) return 1;
    return a.id - b.id;
  });
}
