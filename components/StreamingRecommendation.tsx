"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { loadFavorites } from "@/lib/favorites";
import { loadWatched } from "@/lib/watched";
import { loadPreferences } from "@/lib/preferences";
import {
  computeStreamingRecommendation,
  MIN_INTEREST_SET_SIZE,
  type StreamingRecommendationResult,
} from "@/lib/streaming-recommendations";
import { MovieGrid } from "@/components/MovieGrid";
import { ProviderBadge } from "@/components/ProviderBadge";
import { ProviderComparisonList } from "@/components/ProviderComparisonList";
import { th } from "@/lib/i18n";

type Status = "loading" | "ready" | "error";

function LoadingSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
      <div className="h-40 rounded-xl bg-surface" />
      <div className="h-16 rounded-lg bg-surface" />
      <div className="h-16 rounded-lg bg-surface" />
      <div className="h-16 rounded-lg bg-surface" />
    </div>
  );
}

/** Shared wrapper for the empty/insufficient/error/no-match states - a single centered message card. */
function MessageCard({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 rounded-lg border border-border p-6 text-center text-sm">{children}</div>;
}

export function StreamingRecommendation() {
  const [status, setStatus] = useState<Status>("loading");
  const [result, setResult] = useState<StreamingRecommendationResult | null>(null);
  const [providersByMovieId, setProvidersByMovieId] = useState<Record<number, WatchProviderSummary>>({});
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const favoriteIds = loadFavorites();
      const watchedIds = loadWatched();
      const preferredGenreIds = loadPreferences();
      const interestIds = [...new Set([...favoriteIds, ...watchedIds])];

      if (interestIds.length === 0) {
        if (!cancelled) {
          setResult({ confidence: "empty", totalInterestSetSize: 0, providers: [] });
          setStatus("ready");
        }
        return;
      }

      try {
        const res = await fetch(`/api/tmdb/movies?ids=${interestIds.join(",")}`);
        if (!res.ok) throw new Error(`request failed with status ${res.status}`);
        const data: unknown = await res.json();
        const results =
          data && typeof data === "object" && Array.isArray((data as { results?: unknown }).results)
            ? (data as { results: TMDBMovie[] }).results
            : [];
        const rawProviders = data && typeof data === "object" ? (data as { providers?: unknown }).providers : null;
        const providers =
          rawProviders && typeof rawProviders === "object"
            ? (rawProviders as Record<number, WatchProviderSummary>)
            : {};

        const computed = computeStreamingRecommendation(results, providers, {
          favoriteIds,
          watchedIds,
          preferredGenreIds,
        });

        if (!cancelled) {
          setProvidersByMovieId(providers);
          setResult(computed);
          setSelectedProviderId(computed.providers[0]?.providerId ?? null);
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
    return <p className="mt-8 text-sm text-red-400">{th.streamingRecommendation.loadError}</p>;
  }

  if (!result) return null;

  if (result.confidence === "empty") {
    return (
      <MessageCard>
        <p>{th.streamingRecommendation.emptyState}</p>
        <Link href="/movies" className="mt-3 inline-block text-accent underline underline-offset-2">
          {th.streamingRecommendation.goToMovies}
        </Link>
      </MessageCard>
    );
  }

  if (result.confidence === "insufficient") {
    return (
      <MessageCard>
        <p>{th.streamingRecommendation.insufficientState}</p>
        <p className="mt-1 opacity-60">
          {th.streamingRecommendation.insufficientDetail(result.totalInterestSetSize, MIN_INTEREST_SET_SIZE)}
        </p>
        <Link href="/favorites" className="mt-3 inline-block text-accent underline underline-offset-2">
          {th.streamingRecommendation.goToFavorites}
        </Link>
      </MessageCard>
    );
  }

  // confidence is "low" or "ready" here - but the ranking can still be
  // empty if nothing in the interest set streams in TH.
  if (result.providers.length === 0) {
    return (
      <MessageCard>
        <p>{th.streamingRecommendation.noStreamingMatch}</p>
      </MessageCard>
    );
  }

  const topProvider = result.providers[0];
  const selectedProvider = result.providers.find((p) => p.providerId === selectedProviderId) ?? topProvider;

  return (
    <div className="mt-6 flex flex-col gap-8">
      {/* Always visible, never buried - this is a personalization signal, not a quality/popularity claim. */}
      <p className="rounded-lg border border-border bg-surface p-3 text-xs opacity-70">
        {th.streamingRecommendation.disclaimer}
      </p>

      {result.confidence === "low" && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs text-accent">
          {th.streamingRecommendation.lowConfidenceHint}
        </p>
      )}

      <div className="rounded-xl border border-accent/50 bg-surface p-6 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">
          {th.streamingRecommendation.bestMatchLabel}
        </p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <ProviderBadge
            provider={{
              provider_id: topProvider.providerId,
              provider_name: topProvider.providerName,
              logo_path: topProvider.logoPath,
              display_priority: 0,
            }}
            size={48}
          />
          <h2 className="text-2xl font-bold">{topProvider.providerName}</h2>
        </div>
        <p className="mt-2 text-sm opacity-80">{th.streamingRecommendation.matchCount(topProvider.matchCount)}</p>
        <p className="text-sm opacity-60">{th.streamingRecommendation.watchMatches(topProvider.matchCount)}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold">{th.streamingRecommendation.whySectionTitle}</h2>
        <p className="mt-2 text-sm opacity-80">
          {th.streamingRecommendation.reason(
            topProvider.providerName,
            topProvider.favoriteMatchCount,
            topProvider.watchedOnlyMatchCount,
          )}
        </p>
      </div>

      <ProviderComparisonList
        providers={result.providers}
        selectedProviderId={selectedProvider.providerId}
        onSelectProvider={setSelectedProviderId}
      />

      <div>
        <h2 className="text-sm font-semibold">
          {th.streamingRecommendation.matchingMoviesTitle} · {selectedProvider.providerName}
        </h2>
        {/* Reuses MovieGrid/MovieCard as-is (Part 9) - it self-manages watched/favorite state, so toggling either here works normally. */}
        <MovieGrid movies={selectedProvider.matchedMovies} providersByMovieId={providersByMovieId} />
      </div>
    </div>
  );
}
