"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TMDBGenre } from "@/types/tmdb";
import { buildMoviesHref } from "@/lib/movieSearch";
import { th } from "@/lib/i18n";

export function GenreSearchForm({
  genres,
  initialSelectedGenreIds = [],
}: {
  genres: TMDBGenre[];
  initialSelectedGenreIds?: readonly number[];
}) {
  const router = useRouter();
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>(() => [
    ...initialSelectedGenreIds,
  ]);

  function toggleGenre(id: number) {
    setSelectedGenreIds((current) =>
      current.includes(id) ? current.filter((genreId) => genreId !== id) : [...current, id],
    );
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedGenreIds.length === 0) return;

    // This is current search intent, not a long-term taste preference. Keep
    // it in the URL rather than silently persisting it to the recommendation
    // profile's localStorage state.
    router.push(buildMoviesHref(selectedGenreIds));
  }

  const hasSelection = selectedGenreIds.length > 0;

  return (
    <form onSubmit={handleSearch}>
      <p className="text-sm opacity-70" aria-live="polite">
        {hasSelection
          ? th.genreSearch.selectedCount(selectedGenreIds.length)
          : th.genreSearch.noneSelected}
      </p>

      <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
        {genres.map((genre) => {
          const isSelected = selectedGenreIds.includes(genre.id);
          return (
            <li key={genre.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleGenre(genre.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-transparent hover:border-border-strong"
                }`}
              >
                {genre.name}
              </button>
            </li>
          );
        })}
      </ul>

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
