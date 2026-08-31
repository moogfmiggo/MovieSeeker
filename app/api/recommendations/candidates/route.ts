import { NextResponse } from "next/server";
import {
  getPopularMovies,
  getMovieById,
  getMovieDetails,
  getMovieRecommendations,
  discoverMovies,
  getMovieGenres,
  TMDBConfigError,
  TMDBError,
} from "@/lib/tmdb";
import { FALLBACK_GENRES } from "@/lib/genres";
import { movieDirectors, topBilledCast } from "@/lib/credits";
import {
  mergeCandidatePools,
  buildAffinityProfile,
  MAX_FAVORITES_FOR_CREDIT_SIGNALS,
  MAX_FAVORITES_FOR_SIMILARITY,
  MAX_DISMISSED_FOR_NEGATIVE_SIGNAL,
  type CandidatePool,
  type MovieSignalSource,
} from "@/lib/recommendations-v2";
import type { TMDBGenre, TMDBMovieDetails } from "@/types/tmdb";

// Always fetch live from TMDB at request time — never statically cached at build time.
export const dynamic = "force-dynamic";

function parseIds(raw: string | null): number[] {
  return (raw ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function logSoftFailure(step: string, error: unknown): void {
  console.error(`[recommendations] ${step} failed (continuing without it):`, error instanceof Error ? error.message : "unknown error");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const favoriteIds = parseIds(searchParams.get("favoriteIds"));
  const preferredGenreIds = parseIds(searchParams.get("genreIds"));
  // v3 - additive: omitted entirely, this route behaves exactly as before (no negative signal).
  const dismissedIds = parseIds(searchParams.get("dismissedIds"));

  try {
    // Primary candidate source. Left outside any try/catch on purpose - if
    // even this fails, there is nothing to show *anyone* (including a
    // brand-new user with no signals at all), so it's surfaced as a real
    // error to the client rather than a silently-empty candidate list.
    // Mirrors app/api/tmdb/popular/route.ts's convention.
    const popular = await getPopularMovies();

    // Secondary/display-only data - degrades to the static Thai list rather
    // than failing the request. Mirrors app/preferences/page.tsx exactly.
    let genreList: TMDBGenre[];
    try {
      genreList = (await getMovieGenres()).genres;
    } catch (error) {
      logSoftFailure("genre list fetch", error);
      genreList = FALLBACK_GENRES;
    }
    const genreMap: Record<number, string> = Object.fromEntries(genreList.map((genre) => [genre.id, genre.name]));

    const pools: CandidatePool[] = [{ movies: popular.results, signal: { type: "discoverPool" } }];

    // Everything below is best-effort: an individual failure just means one
    // fewer signal, never a failed response (the popular pool above already
    // guarantees something to show).
    if (preferredGenreIds.length > 0) {
      try {
        const pool = await discoverMovies({ genreIds: preferredGenreIds });
        pools.push({ movies: pool.results, signal: { type: "discoverPool" } });
      } catch (error) {
        logSoftFailure("preferred-genre discover", error);
      }
    }

    let favoriteGenreNames: string[] = [];

    if (favoriteIds.length > 0) {
      // Most recently added first - lib/favorites.ts appends new ids to the
      // end of the array, so the tail is the user's most recent taste.
      const recentFavoriteIds = favoriteIds.slice(-MAX_FAVORITES_FOR_CREDIT_SIGNALS);
      const detailsSettled = await Promise.allSettled(recentFavoriteIds.map((id) => getMovieDetails(id)));
      const favoriteDetails: TMDBMovieDetails[] = [];
      for (const result of detailsSettled) {
        if (result.status === "fulfilled") {
          favoriteDetails.push(result.value);
        } else {
          logSoftFailure("favorite movie detail fetch", result.reason);
        }
      }

      if (favoriteDetails.length > 0) {
        const sources: MovieSignalSource[] = favoriteDetails.map((movie) => ({
          genreIds: movie.genres.map((genre) => genre.id),
          directors: movieDirectors(movie.credits?.crew).map((d) => ({ id: d.id, name: d.name })),
          topCast: topBilledCast(movie.credits?.cast, 5).map((c) => ({ id: c.id, name: c.name })),
          companies: movie.production_companies.map((company) => ({ id: company.id, name: company.name })),
          keywords: movie.keywords?.keywords ?? [],
        }));
        const affinity = buildAffinityProfile(sources);
        favoriteGenreNames = affinity.topGenreIds
          .slice(0, 2)
          .map((id) => genreMap[id])
          .filter((name): name is string => Boolean(name));

        // A favorite-derived genre that isn't already an explicit preference -
        // avoids double-tagging (and double-scoring) the same genre twice.
        const extraGenreId = affinity.topGenreIds.find((id) => !preferredGenreIds.includes(id));
        // v3 - top favorite-derived keyword/theme, if any keyword data was available.
        const topKeyword = affinity.topKeywords[0];

        const similarityFavoriteIds = recentFavoriteIds.slice(-MAX_FAVORITES_FOR_SIMILARITY);

        const [directorPool, actorPool, companyPool, favoriteGenrePool, keywordPool, ...similarityPools] =
          await Promise.allSettled([
            affinity.topDirector ? discoverMovies({ directorId: affinity.topDirector.id }) : Promise.resolve(null),
            affinity.topActor ? discoverMovies({ castId: affinity.topActor.id }) : Promise.resolve(null),
            affinity.topCompany ? discoverMovies({ companyId: affinity.topCompany.id }) : Promise.resolve(null),
            extraGenreId !== undefined ? discoverMovies({ genreIds: [extraGenreId] }) : Promise.resolve(null),
            topKeyword ? discoverMovies({ keywordIds: [topKeyword.id] }) : Promise.resolve(null),
            ...similarityFavoriteIds.map((id) => getMovieRecommendations(id)),
          ]);

        if (directorPool.status === "fulfilled" && directorPool.value && affinity.topDirector) {
          pools.push({
            movies: directorPool.value.results,
            signal: { type: "directorAffinity", personId: affinity.topDirector.id, personName: affinity.topDirector.name },
          });
        } else if (directorPool.status === "rejected") {
          logSoftFailure("director-affinity discover", directorPool.reason);
        }

        if (actorPool.status === "fulfilled" && actorPool.value && affinity.topActor) {
          pools.push({
            movies: actorPool.value.results,
            signal: { type: "actorAffinity", personId: affinity.topActor.id, personName: affinity.topActor.name },
          });
        } else if (actorPool.status === "rejected") {
          logSoftFailure("actor-affinity discover", actorPool.reason);
        }

        if (companyPool.status === "fulfilled" && companyPool.value && affinity.topCompany) {
          pools.push({
            movies: companyPool.value.results,
            signal: { type: "companyAffinity", companyId: affinity.topCompany.id, companyName: affinity.topCompany.name },
          });
        } else if (companyPool.status === "rejected") {
          logSoftFailure("company-affinity discover", companyPool.reason);
        }

        if (favoriteGenrePool.status === "fulfilled" && favoriteGenrePool.value && extraGenreId !== undefined) {
          pools.push({
            movies: favoriteGenrePool.value.results,
            signal: { type: "favoriteGenre", genreId: extraGenreId },
          });
        } else if (favoriteGenrePool.status === "rejected") {
          logSoftFailure("favorite-genre discover", favoriteGenrePool.reason);
        }

        if (keywordPool.status === "fulfilled" && keywordPool.value && topKeyword) {
          pools.push({
            movies: keywordPool.value.results,
            signal: { type: "keywordAffinity", keywordId: topKeyword.id, keywordName: topKeyword.name },
          });
        } else if (keywordPool.status === "rejected") {
          logSoftFailure("keyword-affinity discover", keywordPool.reason);
        }

        similarityPools.forEach((result, index) => {
          const favoriteMovieId = similarityFavoriteIds[index];
          const favoriteDetail = favoriteDetails.find((movie) => movie.id === favoriteMovieId);
          if (result.status === "fulfilled" && favoriteDetail) {
            pools.push({
              movies: result.value.results,
              signal: { type: "favoriteSimilarity", favoriteMovieId, favoriteTitle: favoriteDetail.title },
            });
          } else if (result.status === "rejected") {
            logSoftFailure(`favorite-similarity discover (movie ${favoriteMovieId})`, result.reason);
          }
        });
      }
    }

    // v3 - negative genre affinity (Part 1/6). Deliberately lighter than the
    // favorites path above: getMovieById (not getMovieDetails) since only
    // genre_ids are needed here, not credits/keywords - see the documented
    // limitation on lib/recommendations-v2.ts's scoreCandidateMovie for why
    // negative director/actor/company/keyword matching isn't implemented.
    let negativeGenreIds: number[] = [];
    if (dismissedIds.length > 0) {
      const recentDismissedIds = dismissedIds.slice(-MAX_DISMISSED_FOR_NEGATIVE_SIGNAL);
      const dismissedSettled = await Promise.allSettled(recentDismissedIds.map((id) => getMovieById(id)));
      const dismissedSources: MovieSignalSource[] = [];
      for (const result of dismissedSettled) {
        if (result.status === "fulfilled") {
          dismissedSources.push({
            genreIds: result.value.genre_ids,
            directors: [],
            topCast: [],
            companies: [],
          });
        } else {
          logSoftFailure("dismissed movie genre fetch", result.reason);
        }
      }
      if (dismissedSources.length > 0) {
        negativeGenreIds = buildAffinityProfile(dismissedSources).topGenreIds.slice(0, 5);
      }
    }

    const candidates = mergeCandidatePools(pools);
    return NextResponse.json({ candidates, genreMap, favoriteGenreNames, negativeGenreIds });
  } catch (error) {
    if (error instanceof TMDBConfigError) {
      console.error("[recommendations] configuration error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof TMDBError) {
      console.error("[recommendations] request failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(
      "[recommendations] unexpected error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
