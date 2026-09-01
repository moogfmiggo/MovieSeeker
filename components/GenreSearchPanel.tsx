import { GenreSearchForm } from "@/components/GenreSearchForm";
import { th } from "@/lib/i18n";
import type { TMDBGenre } from "@/types/tmdb";

export function GenreSearchPanel({
  genres,
  initialSelectedGenreIds = [],
}: {
  genres: TMDBGenre[];
  initialSelectedGenreIds?: readonly number[];
}) {
  const selectionKey = initialSelectedGenreIds.join(",") || "none";

  return (
    <section
      id="genre-search"
      className="scroll-mt-24 w-full rounded-xl border border-accent/50 bg-surface p-6 sm:p-10"
    >
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.genreSearch.title}</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-70">{th.genreSearch.subtitle}</p>
      <div className="mt-6">
        <GenreSearchForm
          key={selectionKey}
          genres={genres}
          initialSelectedGenreIds={initialSelectedGenreIds}
        />
      </div>
    </section>
  );
}
