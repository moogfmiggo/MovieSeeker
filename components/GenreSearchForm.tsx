"use client";

import { useState } from "react";
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

type MovieSearchOption =
  | { key: string; kind: "genre"; id: number; name: string }
  | { key: string; kind: "topic"; slug: string; name: string };

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-3.5 w-3.5"
    >
      <path d="m6 6 8 8M14 6l-8 8" />
    </svg>
  );
}

export function GenreSearchForm({
  genres,
  seriesGenres = [],
  streamingProviders = [],
  initialSelectedGenreIds = [],
  initialSelectedTopicSlugs = [],
  initialSelectedProviderIds = [],
  initialSelectedSeriesGenreIds = [],
}: {
  genres: TMDBGenre[];
  seriesGenres?: TMDBGenre[];
  streamingProviders?: TMDBWatchProvider[];
  initialSelectedGenreIds?: readonly number[];
  initialSelectedTopicSlugs?: readonly string[];
  initialSelectedProviderIds?: readonly number[];
  initialSelectedSeriesGenreIds?: readonly number[];
}) {
  const router = useRouter();
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>(() => [
    ...initialSelectedGenreIds,
  ]);
  const [selectedTopicSlugs, setSelectedTopicSlugs] = useState<string[]>(() => [
    ...initialSelectedTopicSlugs,
  ]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<number[]>(() => [
    ...initialSelectedProviderIds,
  ]);
  const [selectedSeriesGenreIds, setSelectedSeriesGenreIds] = useState<number[]>(() => [
    ...initialSelectedSeriesGenreIds,
  ]);
  const [movieQuery, setMovieQuery] = useState("");
  const [seriesQuery, setSeriesQuery] = useState("");

  function toggleGenre(id: number) {
    setSelectedGenreIds((current) =>
      current.includes(id) ? current.filter((genreId) => genreId !== id) : [...current, id],
    );
  }

  function toggleTopic(slug: string) {
    setSelectedTopicSlugs((current) =>
      current.includes(slug) ? current.filter((topicSlug) => topicSlug !== slug) : [...current, slug],
    );
  }

  function toggleProvider(id: number) {
    setSelectedProviderIds((current) =>
      current.includes(id) ? current.filter((providerId) => providerId !== id) : [...current, id],
    );
  }

  function toggleSeriesGenre(id: number) {
    setSelectedSeriesGenreIds((current) =>
      current.includes(id) ? current.filter((genreId) => genreId !== id) : [...current, id],
    );
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      selectedGenreIds.length === 0 &&
      selectedTopicSlugs.length === 0 &&
      selectedProviderIds.length === 0 &&
      selectedSeriesGenreIds.length === 0
    ) return;

    // This is current search intent, not a long-term taste preference. Keep
    // it in the URL rather than silently persisting it to the recommendation
    // profile's localStorage state.
    router.push(
      buildMovieSearchHref(
        selectedGenreIds,
        selectedTopicSlugs,
        selectedProviderIds,
        selectedSeriesGenreIds,
      ),
    );
  }

  const selectedCount =
    selectedGenreIds.length +
    selectedTopicSlugs.length +
    selectedProviderIds.length +
    selectedSeriesGenreIds.length;
  const hasSelection = selectedCount > 0;

  const movieSearchResults: MovieSearchOption[] = normalizeGenreSearchText(movieQuery)
    ? [
        ...genres
          .filter(
            (genre) =>
              !selectedGenreIds.includes(genre.id) &&
              matchesGenreSearch(movieQuery, [
                genre.name,
                ...getMovieGenreSearchTerms(genre.id),
              ]),
          )
          .map((genre) => ({
            key: `genre:${genre.id}`,
            kind: "genre" as const,
            id: genre.id,
            name: genre.name,
          })),
        ...MOVIE_TOPICS.filter(
          (topic) =>
            !selectedTopicSlugs.includes(topic.slug) &&
            matchesGenreSearch(movieQuery, [topic.name, topic.keywordQuery, topic.slug]),
        ).map((topic) => ({
          key: `topic:${topic.slug}`,
          kind: "topic" as const,
          slug: topic.slug,
          name: topic.name,
        })),
      ]
    : [];

  const seriesSearchResults = normalizeGenreSearchText(seriesQuery)
    ? seriesGenres.filter(
        (genre) =>
          !selectedSeriesGenreIds.includes(genre.id) &&
          matchesGenreSearch(seriesQuery, [
            genre.name,
            ...getSeriesGenreSearchTerms(genre.id),
          ]),
      )
    : [];

  const selectedMovieGenres = genres.filter((genre) => selectedGenreIds.includes(genre.id));
  const selectedMovieTopics = MOVIE_TOPICS.filter((topic) =>
    selectedTopicSlugs.includes(topic.slug),
  );
  const selectedSeriesGenres = seriesGenres.filter((genre) =>
    selectedSeriesGenreIds.includes(genre.id),
  );

  return (
    <form onSubmit={handleSearch}>
      <p className="text-sm opacity-70" aria-live="polite">
        {hasSelection
          ? th.genreSearch.selectedCount(selectedCount)
          : th.genreSearch.noneSelected}
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-background/30 p-4 sm:p-5">
          <h3 className="text-base font-semibold">{th.genreSearch.movieGenreSearchTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed opacity-60">
            {th.genreSearch.movieGenreSearchHint}
          </p>

          {selectedMovieGenres.length + selectedMovieTopics.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium opacity-60">
                {th.genreSearch.selectedMovieFilters}
              </p>
              <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                {selectedMovieGenres.map((genre) => (
                  <li key={`selected-genre:${genre.id}`}>
                    <button
                      type="button"
                      onClick={() => toggleGenre(genre.id)}
                      aria-label={th.genreSearch.removeSelection(genre.name)}
                      className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/25"
                    >
                      {genre.name}
                      <RemoveIcon />
                    </button>
                  </li>
                ))}
                {selectedMovieTopics.map((topic) => (
                  <li key={`selected-topic:${topic.slug}`}>
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.slug)}
                      aria-label={th.genreSearch.removeSelection(topic.name)}
                      className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/25"
                    >
                      {topic.name}
                      <RemoveIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="relative mt-4 block">
            <span className="sr-only">{th.genreSearch.movieGenreSearchTitle}</span>
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center opacity-45">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={movieQuery}
              onChange={(event) => setMovieQuery(event.target.value)}
              placeholder={th.genreSearch.movieGenreSearchPlaceholder}
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition placeholder:opacity-45 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {normalizeGenreSearchText(movieQuery) ? (
            movieSearchResults.length > 0 ? (
              <ul className="cinematic-scrollbar mt-3 max-h-56 list-none space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1.5">
                {movieSearchResults.map((option) => (
                  <li key={option.key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (option.kind === "genre") toggleGenre(option.id);
                        else toggleTopic(option.slug);
                        setMovieQuery("");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-foreground/5"
                    >
                      <span className="font-medium">{option.name}</span>
                      <span className="shrink-0 text-[11px] opacity-45">
                        {option.kind === "genre"
                          ? th.genreSearch.movieGenreTag
                          : th.genreSearch.movieTopicTag}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm opacity-60">
                {th.genreSearch.noSearchResults}
              </p>
            )
          ) : (
            <p className="mt-3 text-xs opacity-45">{th.genreSearch.typeToSearch}</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-background/30 p-4 sm:p-5">
          <h3 className="text-base font-semibold">{th.genreSearch.seriesGenreSearchTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed opacity-60">
            {th.genreSearch.seriesGenreSearchHint}
          </p>

          {selectedSeriesGenres.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium opacity-60">
                {th.genreSearch.selectedSeriesFilters}
              </p>
              <ul className="mt-2 flex list-none flex-wrap gap-2 p-0">
                {selectedSeriesGenres.map((genre) => (
                  <li key={`selected-series:${genre.id}`}>
                    <button
                      type="button"
                      onClick={() => toggleSeriesGenre(genre.id)}
                      aria-label={th.genreSearch.removeSelection(genre.name)}
                      className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/25"
                    >
                      {genre.name}
                      <RemoveIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="relative mt-4 block">
            <span className="sr-only">{th.genreSearch.seriesGenreSearchTitle}</span>
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center opacity-45">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={seriesQuery}
              onChange={(event) => setSeriesQuery(event.target.value)}
              placeholder={th.genreSearch.seriesGenreSearchPlaceholder}
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4 text-sm outline-none transition placeholder:opacity-45 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {normalizeGenreSearchText(seriesQuery) ? (
            seriesSearchResults.length > 0 ? (
              <ul className="cinematic-scrollbar mt-3 max-h-56 list-none space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-1.5">
                {seriesSearchResults.map((genre) => (
                  <li key={genre.id}>
                    <button
                      type="button"
                      onClick={() => {
                        toggleSeriesGenre(genre.id);
                        setSeriesQuery("");
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-foreground/5"
                    >
                      <span className="font-medium">{genre.name}</span>
                      <span className="shrink-0 text-[11px] opacity-45">
                        {th.genreSearch.seriesGenreTag}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm opacity-60">
                {th.genreSearch.noSearchResults}
              </p>
            )
          ) : (
            <p className="mt-3 text-xs opacity-45">{th.genreSearch.typeToSearch}</p>
          )}
        </section>
      </div>

      {streamingProviders.length > 0 && (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wide opacity-50">
            {th.genreSearch.streamingProviders}
          </p>
          <p className="mt-1 text-xs opacity-60">{th.genreSearch.streamingProvidersHint}</p>
          <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
            {streamingProviders.map((provider) => {
              const isSelected = selectedProviderIds.includes(provider.provider_id);
              return (
                <li key={provider.provider_id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleProvider(provider.provider_id)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border bg-transparent hover:border-border-strong"
                    }`}
                  >
                    {provider.provider_name}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!hasSelection}
          className="rounded-full bg-accent px-7 py-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {th.genreSearch.search}
        </button>
        {!hasSelection && (
          <span className="text-xs opacity-60">{th.genreSearch.selectAtLeastOne}</span>
        )}
      </div>
    </form>
  );
}
