"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TMDBGenre, TMDBWatchProvider } from "@/types/tmdb";
import { buildMovieSearchHref } from "@/lib/movieSearch";
import { MOVIE_TOPICS } from "@/lib/movieTopics";
import {
  getMovieGenreSearchTerms,
  getSeriesGenreSearchTerms,
  matchesGenreSearch,
  normalizeGenreSearchText,
} from "@/lib/genreSearch";
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
}: {
  genres: TMDBGenre[];
  seriesGenres?: TMDBGenre[];
  streamingProviders?: TMDBWatchProvider[];
  initialSelectedGenreIds?: readonly number[];
  initialSelectedTopicSlugs?: readonly string[];
  initialSelectedProviderIds?: readonly number[];
  initialSelectedSeriesGenreIds?: readonly number[];
  initialSelectedSeriesTopicSlugs?: readonly string[];
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState<"movie" | "tv">(
    (initialSelectedSeriesGenreIds.length > 0 || initialSelectedSeriesTopicSlugs.length > 0) &&
      initialSelectedGenreIds.length === 0 &&
      initialSelectedTopicSlugs.length === 0
      ? "tv"
      : "movie",
  );
  const [query, setQuery] = useState("");
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
      terms: [
        genre.name,
        ...(isSeries
          ? getSeriesGenreSearchTerms(genre.id)
          : getMovieGenreSearchTerms(genre.id)),
      ],
      toggle: () => toggleGenre(genre.id),
    })),
    ...MOVIE_TOPICS.map((topic) => ({
      key: `topic:${topic.slug}`,
      name: topic.name,
      label: isSeries ? th.genreSearch.seriesTopicTag : th.genreSearch.movieTopicTag,
      selected: (isSeries ? selectedSeriesTopicSlugs : selectedTopicSlugs).includes(topic.slug),
      terms: [topic.name, topic.keywordQuery, topic.slug, ...(topic.aliases ?? [])],
      toggle: () => toggleTopic(topic.slug),
    })),
  ];
  const selectedOptions = options.filter((option) => option.selected);
  const results = options.filter(
    (option) => !option.selected && matchesGenreSearch(query, option.terms),
  );
  const hasQuery = !!normalizeGenreSearchText(query);
  const selectedCount = selectedOptions.length + selectedProviderIds.length;
  // A series URL requires at least one explicit TV genre. Provider-only URLs default to movies.
  const canSearch = isSeries
    ? selectedSeriesGenreIds.length + selectedSeriesTopicSlugs.length > 0
    : selectedCount > 0;

  function selectOption(option: (typeof options)[number]) {
    option.toggle();
    setQuery("");
    inputRef.current?.focus();
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSearch) return;

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
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") setQuery("");
            if (event.key === "Enter" && hasQuery) {
              event.preventDefault();
              if (results[0]) selectOption(results[0]);
            }
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
        {hasQuery
          ? th.genreSearch.resultCount(results.length)
          : th.genreSearch.selectedCount(selectedCount)}
      </p>

      {hasQuery &&
        (results.length > 0 ? (
          <ul className="cinematic-scrollbar mt-3 max-h-56 list-none space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1.5">
            {results.map((option) => (
              <li key={option.key}>
                <button
                  type="button"
                  onClick={() => selectOption(option)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-surface-hover focus-visible:bg-surface-hover"
                >
                  <span>{option.name}</span>
                  <span className="text-xs text-muted">{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">{th.genreSearch.noSearchResults}</p>
        ))}

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
        <fieldset className="mt-6">
          <legend className="text-xs font-semibold text-muted">
            {th.genreSearch.streamingProviders}
          </legend>
          <p className="mt-1 text-xs text-muted">
            {th.genreSearch.streamingProvidersHint}
          </p>
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
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSearch}
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSeries ? th.genreSearch.searchSeries : th.genreSearch.searchMovies}
        </button>
        <span className="text-xs text-muted">
          {canSearch
            ? th.genreSearch.selectedCount(selectedCount)
            : isSeries
              ? th.genreSearch.selectSeriesGenre
              : th.genreSearch.selectAtLeastOne}
        </span>
      </div>
    </form>
  );
}
