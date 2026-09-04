import { NextResponse } from "next/server";
import {
  getStreamingMovies,
  getMovieDetails,
  getMovieRecommendations,
  discoverStreamingMovies,
  getMovieGenres,
  TMDBConfigError,
  TMDBError,
} from "@/lib/tmdb";
import { FALLBACK_GENRES } from "@/lib/genres";
import { movieDirectors, topBilledCast } from "@/lib/credits";
import {
  mergeCandidatePools,
  attachSignalsToExistingCandidates,
  buildAffinityProfile,
  MAX_FAVORITES_FOR_CREDIT_SIGNALS,
  MAX_FAVORITES_FOR_SIMILARITY,
  MAX_DISMISSED_FOR_NEGATIVE_SIGNAL,
  MIN_RICH_NEGATIVE_OCCURRENCES,
  affinityOccurrenceCount,
  type CandidatePool,
  type MovieSignalSource,
} from "@/lib/recommendations-v2";
import type { TMDBGenre, TMDBMovie, TMDBMovieDetails } from "@/types/tmdb";

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

function recordStreamingIds(target: Set<number>, movies: readonly TMDBMovie[]): void {
  for (const movie of movies) target.add(movie.id);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const favoriteIds = parseIds(searchParams.get("favoriteIds"));
  const preferredGenreIds = parseIds(searchParams.get("genreIds"));
  // v3 - additive: omitted entirely, this route behaves exactly as before (no negative signal).
  const dismissedIds = parseIds(searchParams.get("dismissedIds"));

  try {
    // Primary candidate source: titles available through subscription,
    // free, or ad-supported streaming in Thailand. Left outside any
    // try/catch on purpose: a failure is surfaced instead of silently
    // falling back to unrelated worldwide titles.
    const streaming = await getStreamingMovies();

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

    const pools: CandidatePool[] = [{ movies: streaming.results, signal: { type: "discoverPool" } }];
    const streamingCandidateIds = new Set(streaming.results.map((movie) => movie.id));

    // Everything below is best-effort: an individual failure just means one
    // fewer signal, never a failed response (the streaming pool above already
    // guarantees something to show).
    if (preferredGenreIds.length > 0) {
      try {
        const pool = await discoverStreamingMovies({ genreIds: preferredGenreIds });
        pools.push({ movies: pool.results, signal: { type: "discoverPool" } });
        recordStreamingIds(streamingCandidateIds, pool.results);
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
            affinity.topDirector ? discoverStreamingMovies({ directorId: affinity.topDirector.id }) : Promise.resolve(null),
            affinity.topActor ? discoverStreamingMovies({ castId: affinity.topActor.id }) : Promise.resolve(null),
            affinity.topCompany ? discoverStreamingMovies({ companyId: affinity.topCompany.id }) : Promise.resolve(null),
            extraGenreId !== undefined ? discoverStreamingMovies({ genreIds: [extraGenreId] }) : Promise.resolve(null),
            topKeyword ? discoverStreamingMovies({ keywordIds: [topKeyword.id] }) : Promise.resolve(null),
            ...similarityFavoriteIds.map((id) => getMovieRecommendations(id)),
          ]);

        if (directorPool.status === "fulfilled" && directorPool.value && affinity.topDirector) {
          recordStreamingIds(streamingCandidateIds, directorPool.value.results);
          pools.push({
            movies: directorPool.value.results,
            signal: { type: "directorAffinity", personId: affinity.topDirector.id, personName: affinity.topDirector.name },
          });
        } else if (directorPool.status === "rejected") {
          logSoftFailure("director-affinity discover", directorPool.reason);
        }

        if (actorPool.status === "fulfilled" && actorPool.value && affinity.topActor) {
          recordStreamingIds(streamingCandidateIds, actorPool.value.results);
          pools.push({
            movies: actorPool.value.results,
            signal: { type: "actorAffinity", personId: affinity.topActor.id, personName: affinity.topActor.name },
          });
        } else if (actorPool.status === "rejected") {
          logSoftFailure("actor-affinity discover", actorPool.reason);
        }

        if (companyPool.status === "fulfilled" && companyPool.value && affinity.topCompany) {
          recordStreamingIds(streamingCandidateIds, companyPool.value.results);
          pools.push({
            movies: companyPool.value.results,
            signal: { type: "companyAffinity", companyId: affinity.topCompany.id, companyName: affinity.topCompany.name },
          });
        } else if (companyPool.status === "rejected") {
          logSoftFailure("company-affinity discover", companyPool.reason);
        }

        if (favoriteGenrePool.status === "fulfilled" && favoriteGenrePool.value && extraGenreId !== undefined) {
          recordStreamingIds(streamingCandidateIds, favoriteGenrePool.value.results);
          pools.push({
            movies: favoriteGenrePool.value.results,
            signal: { type: "favoriteGenre", genreId: extraGenreId },
          });
        } else if (favoriteGenrePool.status === "rejected") {
          logSoftFailure("favorite-genre discover", favoriteGenrePool.reason);
        }

        if (keywordPool.status === "fulfilled" && keywordPool.value && topKeyword) {
          recordStreamingIds(streamingCandidateIds, keywordPool.value.results);
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

    // Rich negative taste is bounded to the most recent dismissed titles.
    // Discovery pools below only annotate candidates that already entered
    // through positive pools; they never introduce disliked movies by themselves.
    let negativeGenreIds: number[] = [];
    const negativeSignalPools: CandidatePool[] = [];
    if (dismissedIds.length > 0) {
      const recentDismissedIds = dismissedIds.slice(-MAX_DISMISSED_FOR_NEGATIVE_SIGNAL);
      const dismissedSettled = await Promise.allSettled(
        recentDismissedIds.map((id) => getMovieDetails(id)),
      );
      const dismissedSources: MovieSignalSource[] = [];
      for (const result of dismissedSettled) {
        if (result.status === "fulfilled") {
          dismissedSources.push({
            genreIds: result.value.genres.map((genre) => genre.id),
            directors: movieDirectors(result.value.credits?.crew).map((person) => ({
              id: person.id,
              name: person.name,
            })),
            topCast: topBilledCast(result.value.credits?.cast, 5).map((person) => ({
              id: person.id,
              name: person.name,
            })),
            companies: result.value.production_companies.map((company) => ({
              id: company.id,
              name: company.name,
            })),
            keywords: result.value.keywords?.keywords ?? [],
          });
        } else {
          logSoftFailure("dismissed movie detail fetch", result.reason);
        }
      }
      if (dismissedSources.length > 0) {
        const negativeAffinity = buildAffinityProfile(dismissedSources);
        negativeGenreIds = negativeAffinity.topGenreIds.slice(0, 5);
        const negativeDirector = negativeAffinity.topDirector &&
          affinityOccurrenceCount(dismissedSources, "director", negativeAffinity.topDirector.id) >= MIN_RICH_NEGATIVE_OCCURRENCES
          ? negativeAffinity.topDirector
          : null;
        const negativeActor = negativeAffinity.topActor &&
          affinityOccurrenceCount(dismissedSources, "actor", negativeAffinity.topActor.id) >= MIN_RICH_NEGATIVE_OCCURRENCES
          ? negativeAffinity.topActor
          : null;
        const negativeCompany = negativeAffinity.topCompany &&
          affinityOccurrenceCount(dismissedSources, "company", negativeAffinity.topCompany.id) >= MIN_RICH_NEGATIVE_OCCURRENCES
          ? negativeAffinity.topCompany
          : null;
        const topNegativeKeyword = negativeAffinity.topKeywords[0];
        const negativeKeyword = topNegativeKeyword &&
          affinityOccurrenceCount(dismissedSources, "keyword", topNegativeKeyword.id) >= MIN_RICH_NEGATIVE_OCCURRENCES
          ? topNegativeKeyword
          : null;
        const [directorPool, actorPool, companyPool, keywordPool] = await Promise.allSettled([
          negativeDirector
            ? discoverStreamingMovies({ directorId: negativeDirector.id })
            : Promise.resolve(null),
          negativeActor
            ? discoverStreamingMovies({ castId: negativeActor.id })
            : Promise.resolve(null),
          negativeCompany
            ? discoverStreamingMovies({ companyId: negativeCompany.id })
            : Promise.resolve(null),
          negativeKeyword
            ? discoverStreamingMovies({ keywordIds: [negativeKeyword.id] })
            : Promise.resolve(null),
        ]);

        if (directorPool.status === "fulfilled" && directorPool.value && negativeDirector) {
          negativeSignalPools.push({
            movies: directorPool.value.results,
            signal: {
              type: "negativeDirectorAffinity",
              personId: negativeDirector.id,
              personName: negativeDirector.name,
            },
          });
        } else if (directorPool.status === "rejected") {
          logSoftFailure("negative director discover", directorPool.reason);
        }

        if (actorPool.status === "fulfilled" && actorPool.value && negativeActor) {
          negativeSignalPools.push({
            movies: actorPool.value.results,
            signal: {
              type: "negativeActorAffinity",
              personId: negativeActor.id,
              personName: negativeActor.name,
            },
          });
        } else if (actorPool.status === "rejected") {
          logSoftFailure("negative actor discover", actorPool.reason);
        }

        if (companyPool.status === "fulfilled" && companyPool.value && negativeCompany) {
          negativeSignalPools.push({
            movies: companyPool.value.results,
            signal: {
              type: "negativeCompanyAffinity",
              companyId: negativeCompany.id,
              companyName: negativeCompany.name,
            },
          });
        } else if (companyPool.status === "rejected") {
          logSoftFailure("negative company discover", companyPool.reason);
        }

        if (keywordPool.status === "fulfilled" && keywordPool.value && negativeKeyword) {
          negativeSignalPools.push({
            movies: keywordPool.value.results,
            signal: {
              type: "negativeKeywordAffinity",
              keywordId: negativeKeyword.id,
              keywordName: negativeKeyword.name,
            },
          });
        } else if (keywordPool.status === "rejected") {
          logSoftFailure("negative keyword discover", keywordPool.reason);
        }
      }
    }

    const candidates = attachSignalsToExistingCandidates(
      mergeCandidatePools(pools),
      negativeSignalPools,
    );
    return NextResponse.json({
      candidates,
      genreMap,
      favoriteGenreNames,
      negativeGenreIds,
      streamingCandidateIds: [...streamingCandidateIds],
    });
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
