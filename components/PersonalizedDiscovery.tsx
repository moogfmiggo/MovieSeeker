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
import { prioritizeStreamingCandidates } from "@/lib/homeDiscovery";
import type { WatchProviderSummary } from "@/lib/watchProviders";

const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";

// Part 14 - "avoid recommendation fatigue": one hero + a small, curated grid,
// not dozens of rows.
const FOR_YOU_GRID_SIZE = 9;
const DISCOVERY_ROW_SIZE = 6;

type Status = "loading" | "ready" | "error";

interface CandidatesResponse {
  candidates: CandidateMovie[];
  genreMap: Record<number, string>;
  favoriteGenreNames: string[];
  /** v3 - genres frequent among dismissed movies; reduces score, doesn't exclude. */
  negativeGenreIds: number[];
  /** IDs confirmed by TMDB Discover as streamable in Thailand. */
  streamingCandidateIds: number[];
}

function isCandidatesResponse(data: unknown): data is CandidatesResponse {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { candidates?: unknown }).candidates) &&
    typeof (data as { genreMap?: unknown }).genreMap === "object" &&
    Array.isArray((data as { streamingCandidateIds?: unknown }).streamingCandidateIds)
  );
}

interface HomeDiscoveryResponse {
  streaming: TMDBMovie[];
  nowPlaying: TMDBMovie[];
}

function isHomeDiscoveryResponse(data: unknown): data is HomeDiscoveryResponse {
  return (
    !!data &&
    typeof data === "object" &&
    Array.isArray((data as { streaming?: unknown }).streaming) &&
    Array.isArray((data as { nowPlaying?: unknown }).nowPlaying)
  );
}

interface ProvidersResponse {
  providers: Record<number, WatchProviderSummary>;
}

function isProvidersResponse(data: unknown): data is ProvidersResponse {
  return (
    !!data &&
    typeof data === "object" &&
    !!(data as { providers?: unknown }).providers &&
    typeof (data as { providers?: unknown }).providers === "object"
  );
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
  const [streamingMovies, setStreamingMovies] = useState<TMDBMovie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<TMDBMovie[]>([]);
  const [providersByMovieId, setProvidersByMovieId] = useState<
    Record<number, WatchProviderSummary>
  >({});

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
        // Thailand streaming + theatrical discovery is always fetched;
        // personalized candidates are only worth fetching once there's at
        // least one real signal to personalize from - skips the whole
        // multi-call TMDB orchestration for a brand-new visitor.
        const [homeRes, candidatesRes] = await Promise.all([
          fetch("/api/tmdb/home"),
          profile === "new" ? null : fetch(buildCandidatesUrl(favoriteIds, preferredGenreIds, dismissedIds)),
        ]);

        if (!homeRes.ok) throw new Error(`home discovery failed with status ${homeRes.status}`);
        const homeData: unknown = await homeRes.json();
        if (!isHomeDiscoveryResponse(homeData)) throw new Error("invalid home discovery response");

        let results: ScoredMovie[] = [];
        let favoriteGenreNames: string[] = [];

        if (candidatesRes?.ok) {
          const candidatesData: unknown = await candidatesRes.json();
          if (isCandidatesResponse(candidatesData)) {
            results = prioritizeStreamingCandidates(
              rankRecommendations(candidatesData.candidates, {
                preferredGenreIds,
                watchedIds,
                dismissedIds,
                genreMap: candidatesData.genreMap,
                negativeGenreIds: candidatesData.negativeGenreIds,
              }),
              candidatesData.streamingCandidateIds,
            );
            favoriteGenreNames = candidatesData.favoriteGenreNames;
          }
        }

        const availableStreaming = homeData.streaming.filter(
          (movie) => !excludedIds.has(movie.id),
        );
        const availableNowPlaying = homeData.nowPlaying.filter(
          (movie) => !excludedIds.has(movie.id),
        );

        if (!cancelled) {
          setStreamingMovies(availableStreaming);
          setNowPlayingMovies(availableNowPlaying);
          setRanked(results);
          setPatternGenreNames(favoriteGenreNames);
          setStatus("ready");
        }

        const providerMovieIds = (
          results.length > 0
            ? results.slice(0, FOR_YOU_GRID_SIZE + 1).map((item) => item.movie.id)
            : availableStreaming.slice(0, DISCOVERY_ROW_SIZE).map((movie) => movie.id)
        );
        if (providerMovieIds.length > 0) {
          try {
            const providersRes = await fetch(buildProvidersUrl(providerMovieIds));
            if (providersRes.ok) {
              const providersData: unknown = await providersRes.json();
              if (!cancelled && isProvidersResponse(providersData)) {
                setProvidersByMovieId(providersData.providers);
              }
            }
          } catch {
            // Provider logos are progressive enhancement. The discovery
            // sections remain valid because TMDB already filtered their pools.
          }
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

  const streamingSection = streamingMovies.length > 0 && (
    <div>
      <h2 className="text-lg font-semibold">{th.home.streamingTitle}</h2>
      <p className="mt-1 text-sm opacity-60">{th.home.streamingSubtitle}</p>
      <MovieGrid
        movies={streamingMovies.slice(0, DISCOVERY_ROW_SIZE)}
        providersByMovieId={providersByMovieId}
      />
    </div>
  );

  const nowPlayingSection = nowPlayingMovies.length > 0 && (
    <div>
      <h2 className="text-lg font-semibold">{th.home.nowPlayingTitle}</h2>
      <p className="mt-1 text-sm opacity-60">{th.home.nowPlayingSubtitle}</p>
      <MovieGrid movies={nowPlayingMovies.slice(0, DISCOVERY_ROW_SIZE)} />
    </div>
  );

  if (profileState === "new") {
    return (
      <div className="flex flex-col gap-10">
        {streamingSection}
        {nowPlayingSection}
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="flex flex-col gap-10">
        <MessageCard>
          <p>{th.home.noCandidates}</p>
        </MessageCard>
        {streamingSection}
        {nowPlayingSection}
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
          <MovieGrid
            movies={gridMovies}
            providersByMovieId={providersByMovieId}
            scoresByMovieId={scoresByMovieId}
            reasonsByMovieId={reasonsByMovieId}
          />
        </div>
      )}

      {nowPlayingSection}
    </div>
  );
}

function buildProvidersUrl(movieIds: number[]): string {
  return `/api/tmdb/providers?ids=${movieIds.join(",")}`;
}

function buildCandidatesUrl(favoriteIds: number[], preferredGenreIds: number[], dismissedIds: number[]): string {
  const params = new URLSearchParams();
  if (favoriteIds.length > 0) params.set("favoriteIds", favoriteIds.join(","));
  if (preferredGenreIds.length > 0) params.set("genreIds", preferredGenreIds.join(","));
  if (dismissedIds.length > 0) params.set("dismissedIds", dismissedIds.join(","));
  return `/api/recommendations/candidates?${params.toString()}`;
}
