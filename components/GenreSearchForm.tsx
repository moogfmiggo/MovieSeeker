"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { TMDBGenre, TMDBWatchProvider } from "@/types/tmdb";
import { buildMovieSearchHref } from "@/lib/movieSearch";
import { MOVIE_TOPICS } from "@/lib/movieTopics";
import { normalizeGenreSearchText } from "@/lib/genreSearch";
import {
  buildNaturalSearchHref,
  interpretNaturalSearchFallback,
  type SearchMediaType,
} from "@/lib/naturalSearch";
import { th } from "@/lib/i18n";

export function GenreSearchForm({
  genres,
  seriesGenres = [],
  streamingProviders = [],
  initialSelectedGenreIds = [],
  initialSelectedTopicSlugs = [],
  initialSelectedProviderIds = [],
  initialSelectedSeriesGenreIds = [],
  initialSelectedSeriesTopicSlugs = [],
  initialQuery = "",
  initialMediaType,
}: {
  genres: TMDBGenre[];
  seriesGenres?: TMDBGenre[];
  streamingProviders?: TMDBWatchProvider[];
  initialSelectedGenreIds?: readonly number[];
  initialSelectedTopicSlugs?: readonly string[];
  initialSelectedProviderIds?: readonly number[];
  initialSelectedSeriesGenreIds?: readonly number[];
  initialSelectedSeriesTopicSlugs?: readonly string[];
  initialQuery?: string;
  initialMediaType?: SearchMediaType;
}) {
  const router = useRouter();
  const inputId = useId();
  const [mediaType, setMediaType] = useState<"movie" | "tv">(
    initialMediaType ??
    ((initialSelectedSeriesGenreIds.length > 0 || initialSelectedSeriesTopicSlugs.length > 0) &&
      initialSelectedGenreIds.length === 0 &&
      initialSelectedTopicSlugs.length === 0
      ? "tv"
      : "movie"),
  );
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([
    ...initialSelectedGenreIds,
  ]);
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>([
    ...initialSelectedTopicSlugs,
  ]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>([
    ...initialSelectedProviderIds,
  ]);
  const [selectedSeriesGenreIds, setSelectedSeriesGenreIds] = useState<number[]>([
    ...initialSelectedSeriesGenreIds,
  ]);
  const [selectedSeriesTopicSlugs, setSelectedSeriesTopicSlugs] = useState<string[]>([
    ...initialSelectedSeriesTopicSlugs,
  ]);
  const isSeries = mediaType === "tv";

  function toggleGenre(id: number) {
    const update = (current: number[]) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    if (isSeries) setSelectedSeriesGenreIds(update);
    else setSelectedGenreIds(update);
  }

  function toggleTopic(slug: string) {
    const update = (current: string[]) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug];
    if (isSeries) setSelectedSeriesTopicSlugs(update);
    else setSelectedTopicSlugs(update);
  }

  const activeGenreIds = isSeries ? selectedSeriesGenreIds : selectedGenreIds;
  const options = [
    ...(isSeries ? seriesGenres : genres).map((genre) => ({
      key: `genre:${genre.id}`,
      name: genre.name,
      label: isSeries ? th.genreSearch.seriesGenreTag : th.genreSearch.movieGenreTag,
      selected: activeGenreIds.includes(genre.id),
      toggle: () => toggleGenre(genre.id),
    })),
    ...MOVIE_TOPICS.map((topic) => ({
      key: `topic:${topic.slug}`,
      name: topic.name,
      label: isSeries ? th.genreSearch.seriesTopicTag : th.genreSearch.movieTopicTag,
      selected: (isSeries ? selectedSeriesTopicSlugs : selectedTopicSlugs).includes(topic.slug),
      toggle: () => toggleTopic(topic.slug),
    })),
  ];
  const selectedOptions = options.filter((option) => option.selected);
  const hasQuery = !!normalizeGenreSearchText(query);
  const selectedCount = selectedOptions.length + selectedProviderIds.length;
  // A series URL requires at least one explicit TV genre. Provider-only URLs default to movies.
  const canSearch = isSeries
    ? selectedSeriesGenreIds.length + selectedSeriesTopicSlugs.length > 0
    : selectedCount > 0;

  const canSubmit = hasQuery || canSearch;

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || isSearching) return;

    if (hasQuery) {
      setIsSearching(true);
      const preferredMediaType: SearchMediaType = isSeries ? "tv" : "movie";
      try {
        const response = await fetch("/api/search/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query,
            preferredMediaType,
            providerIds: selectedProviderIds,
          }),
        });
        if (!response.ok) throw new Error(`intent search failed with status ${response.status}`);
        const data: unknown = await response.json();
        const href =
          data && typeof data === "object" && typeof (data as { href?: unknown }).href === "string"
            ? (data as { href: string }).href
            : "";
        if (!href.startsWith("/movies?")) throw new Error("invalid intent search response");
        router.push(href);
      } catch {
        // The route itself may be unavailable during a deploy. Keep the same
        // zero-queue guarantee by interpreting known Genre terms in-browser.
        const fallback = interpretNaturalSearchFallback(query, preferredMediaType);
        router.push(
          buildNaturalSearchHref(fallback, query, "genre-fallback", selectedProviderIds),
        );
      } finally {
        setIsSearching(false);
      }
      return;
    }

    // Keep draft selections in both modes, while the URL contains only the active media type.
    router.push(
      buildMovieSearchHref(
        isSeries ? [] : selectedGenreIds,
        isSeries ? [] : selectedTopicSlugs,
        selectedProviderIds,
        isSeries ? selectedSeriesGenreIds : [],
        isSeries ? selectedSeriesTopicSlugs : [],
      ),
    );
  }

  return (
    <form onSubmit={handleSearch}>
      <div
        className="inline-flex rounded-full border border-border bg-background p-1"
        role="group"
        aria-label={th.titleSearch.typeLabel}
      >
        {(["movie", "tv"] as const).map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={mediaType === type}
            onClick={() => {
              setMediaType(type);
              setQuery("");
            }}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              mediaType === type
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {type === "movie" ? th.common.movieLabel : th.common.seriesLabel}
          </button>
        ))}
      </div>

      <label htmlFor={inputId} className="mt-4 block text-sm font-medium">
        {isSeries
          ? th.genreSearch.seriesGenreSearchTitle
          : th.genreSearch.movieGenreSearchTitle}
      </label>
      <div className="relative mt-2">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-muted"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          id={inputId}
          type="search"
          maxLength={300}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") setQuery("");
          }}
          aria-describedby={`${inputId}-hint`}
          placeholder={
            isSeries
              ? th.genreSearch.seriesGenreSearchPlaceholder
              : th.genreSearch.movieGenreSearchPlaceholder
          }
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm outline-none transition placeholder:text-subtle focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>
      <p id={`${inputId}-hint`} className="mt-2 text-xs text-muted">
        {isSeries
          ? th.genreSearch.seriesGenreSearchHint
          : th.genreSearch.movieGenreSearchHint}
      </p>
      <p className="sr-only" aria-live="polite">
        {isSearching ? th.genreSearch.interpreting : th.genreSearch.selectedCount(selectedCount)}
      </p>

      {selectedOptions.length > 0 && (
        <ul
          className="mt-4 flex list-none flex-wrap gap-2 p-0"
          aria-label={
            isSeries
              ? th.genreSearch.selectedSeriesFilters
              : th.genreSearch.selectedMovieFilters
          }
        >
          {selectedOptions.map((option) => (
            <li key={option.key}>
              <button
                type="button"
                onClick={option.toggle}
                aria-label={th.genreSearch.removeSelection(option.name)}
                className="flex items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-2 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                {option.name}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {streamingProviders.length > 0 && (
        <details className="mt-6 rounded-xl border border-border bg-background/40 p-4" defaultOpen={selectedProviderIds.length > 0}>
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            {th.genreSearch.optionalStreamingProviders}
          </summary>
          <fieldset className="mt-4">
            <legend className="sr-only">{th.genreSearch.streamingProviders}</legend>
            <p className="text-xs text-muted">{th.genreSearch.streamingProvidersHint}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {streamingProviders.map((provider) => {
                const selected = selectedProviderIds.includes(provider.provider_id);
                return (
                  <button
                    key={provider.provider_id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedProviderIds((current) =>
                        selected
                          ? current.filter((id) => id !== provider.provider_id)
                          : [...current, provider.provider_id],
                      )
                    }
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      selected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    {provider.provider_name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </details>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit || isSearching}
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSearching
            ? th.genreSearch.interpreting
            : isSeries
              ? th.genreSearch.searchSeries
              : th.genreSearch.searchMovies}
        </button>
        <span className="text-xs text-muted">
          {hasQuery
            ? th.genreSearch.oneStepHint
            : canSearch
              ? th.genreSearch.selectedCount(selectedCount)
              : isSeries
                ? th.genreSearch.selectSeriesGenre
                : th.genreSearch.selectAtLeastOne}
        </span>
      </div>
    </form>
  );
}
