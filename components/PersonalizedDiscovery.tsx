"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import { loadPreferences } from "@/lib/preferences";
import { loadFavorites } from "@/lib/favorites";
import { loadWatched } from "@/lib/watched";
import { loadDismissed } from "@/lib/dismissed";
import {
  rankRecommendations,
  determineProfileState,
  type CandidateMovie,
  type ScoredMovie,
  type ProfileState,
} from "@/lib/recommendations-v2";
import { MovieGrid } from "@/components/MovieGrid";
import { th, explainMatchReason } from "@/lib/i18n";

const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";

// Part 14 - "avoid recommendation fatigue": one hero + a small, curated grid,
// not dozens of rows.
const FOR_YOU_GRID_SIZE = 9;
const POPULAR_ROW_SIZE = 6;

type Status = "loading" | "ready" | "error";

interface CandidatesResponse {
  candidates: CandidateMovie[];
  genreMap: Record<number, string>;
  favoriteGenreNames: string[];
  /** v3 - genres frequent among dismissed movies; reduces score, doesn't exclude. */
  negativeGenreIds: number[];
}

function isCandidatesResponse(data: unknown): data is CandidatesResponse {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { candidates?: unknown }).candidates) &&
    typeof (data as { genreMap?: unknown }).genreMap === "object"
  );
}

interface PopularResponse {
  results: TMDBMovie[];
}

function isPopularResponse(data: unknown): data is PopularResponse {
  return !!data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results);
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="h-64 rounded-xl bg-surface sm:h-80" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] rounded-lg bg-surface" />
        ))}
      </div>
    </div>
  );
}

/** Shared wrapper for onboarding/empty/error message blocks - mirrors StreamingRecommendation's MessageCard. */
function MessageCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border p-6 text-center text-sm">{children}</div>;
}

export function PersonalizedDiscovery() {
  const [status, setStatus] = useState<Status>("loading");
  const [profileState, setProfileState] = useState<ProfileState>("new");
  const [ranked, setRanked] = useState<ScoredMovie[]>([]);
  const [patternGenreNames, setPatternGenreNames] = useState<string[]>([]);
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const preferredGenreIds = loadPreferences();
      const favoriteIds = loadFavorites();
      const watchedIds = loadWatched();
      const dismissedIds = loadDismissed();
      const profile = determineProfileState({ preferredGenreIds, favoriteIds, watchedIds });
      if (!cancelled) setProfileState(profile);

      const excludedIds = new Set([...watchedIds, ...dismissedIds]);

      try {
        // Popular is always fetched (secondary section + State A's only
        // content); candidates are only worth fetching once there's at
        // least one real signal to personalize from - skips the whole
        // multi-call TMDB orchestration for a brand-new visitor.
        const [popularRes, candidatesRes] = await Promise.all([
          fetch("/api/tmdb/popular"),
          profile === "new" ? null : fetch(buildCandidatesUrl(favoriteIds, preferredGenreIds, dismissedIds)),
        ]);

        if (!popularRes.ok) throw new Error(`popular request failed with status ${popularRes.status}`);
        const popularData: unknown = await popularRes.json();
        const popular = isPopularResponse(popularData) ? popularData.results : [];

        let results: ScoredMovie[] = [];
        let favoriteGenreNames: string[] = [];

        if (candidatesRes) {
          if (!candidatesRes.ok) throw new Error(`candidates request failed with status ${candidatesRes.status}`);
          const candidatesData: unknown = await candidatesRes.json();
          if (isCandidatesResponse(candidatesData)) {
            results = rankRecommendations(candidatesData.candidates, {
              preferredGenreIds,
              watchedIds,
              dismissedIds,
              genreMap: candidatesData.genreMap,
              negativeGenreIds: candidatesData.negativeGenreIds,
            });
            favoriteGenreNames = candidatesData.favoriteGenreNames;
          }
        }

        if (!cancelled) {
          setPopularMovies(popular.filter((movie) => !excludedIds.has(movie.id)));
          setRanked(results);
          setPatternGenreNames(favoriteGenreNames);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") return <LoadingSkeleton />;

  if (status === "error") {
    return <p className="text-sm text-red-400">{th.home.loadError}</p>;
  }

  const popularSection = popularMovies.length > 0 && (
    <div>
      <h2 className="text-sm font-semibold opacity-70">{th.home.popularTitle}</h2>
      <MovieGrid movies={popularMovies.slice(0, POPULAR_ROW_SIZE)} />
    </div>
  );

  if (profileState === "new") {
    return (
      <div className="flex flex-col gap-10">
        <div className="rounded-xl border border-accent/50 bg-surface p-8 text-center sm:p-12">
          <h1 className="text-xl font-bold sm:text-2xl">{th.home.newUserTitle}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm opacity-70">{th.home.newUserBody}</p>
          <Link
            href="/preferences"
            className="mt-5 inline-block rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
          >
            {th.home.newUserCta}
          </Link>
        </div>
        {popularSection}
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <MessageCard>
          <p>{th.home.noCandidates}</p>
        </MessageCard>
        {popularSection}
      </div>
    );
  }

  const [hero, ...rest] = ranked;
  const gridResults = rest.slice(0, FOR_YOU_GRID_SIZE);
  const gridMovies = gridResults.map((r) => r.movie);
  const scoresByMovieId = Object.fromEntries(gridResults.map((r) => [r.movie.id, r.score]));
  const reasonsByMovieId = Object.fromEntries(
    gridResults.map((r) => [r.movie.id, explainMatchReason(r.primaryReason)]),
  );

  return (
    <div className="flex flex-col gap-10">
      {profileState === "preferencesOnly" && <p className="text-sm opacity-70">{th.home.preferencesOnlyBody}</p>}
      {profileState === "someInteraction" && <p className="text-sm opacity-70">{th.home.someInteractionBody}</p>}
      {profileState === "strong" && patternGenreNames.length > 0 && (
        <p className="text-sm opacity-70">{th.home.strongPattern(patternGenreNames)}</p>
      )}

      <Link href={`/movies/${hero.movie.id}`} className="group block overflow-hidden rounded-xl border border-accent/50 bg-surface">
        <div className="relative">
          {hero.movie.backdrop_path && (
            <div className="absolute inset-0">
              <Image
                src={`${BACKDROP_BASE_URL}${hero.movie.backdrop_path}`}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover opacity-40 transition group-hover:opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-surface/40" />
            </div>
          )}
          <div className="relative flex flex-col gap-2 p-6 sm:p-10">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">{th.home.heroEyebrow}</p>
            <h1 className="text-2xl font-bold sm:text-4xl">{hero.movie.title}</h1>
            <span className="w-fit rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
              {th.home.matchScore(hero.score)}
            </span>
            <p className="mt-1 max-w-xl text-sm opacity-80">{explainMatchReason(hero.primaryReason)}</p>
            <span className="mt-3 w-fit text-sm text-accent underline underline-offset-2">{th.home.viewDetails}</span>
          </div>
        </div>
      </Link>

      {gridMovies.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold">{th.movieList.recommendedForYou}</h2>
          <MovieGrid movies={gridMovies} scoresByMovieId={scoresByMovieId} reasonsByMovieId={reasonsByMovieId} />
        </div>
      )}

      {popularSection}
    </div>
  );
}

function buildCandidatesUrl(favoriteIds: number[], preferredGenreIds: number[], dismissedIds: number[]): string {
  const params = new URLSearchParams();
  if (favoriteIds.length > 0) params.set("favoriteIds", favoriteIds.join(","));
  if (preferredGenreIds.length > 0) params.set("genreIds", preferredGenreIds.join(","));
  if (dismissedIds.length > 0) params.set("dismissedIds", dismissedIds.join(","));
  return `/api/recommendations/candidates?${params.toString()}`;
}
