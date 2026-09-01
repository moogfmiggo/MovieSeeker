import { PersonalizedDiscovery } from "@/components/PersonalizedDiscovery";
import { GenreSearchForm } from "@/components/GenreSearchForm";
import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { FALLBACK_GENRES } from "@/lib/genres";
import type { TMDBGenre } from "@/types/tmdb";
import { th } from "@/lib/i18n";

export default async function Home() {
  let genres: TMDBGenre[];

  try {
    genres = (await getMovieGenres()).genres;
  } catch (error) {
    console.error(
      "[home] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
    genres = FALLBACK_GENRES;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section id="genre-search" className="scroll-mt-24 rounded-xl border border-accent/50 bg-surface p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.genreSearch.title}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-70">{th.genreSearch.subtitle}</p>
        <div className="mt-6">
          <GenreSearchForm genres={genres} />
        </div>
      </section>

      <div className="mt-10">
        <PersonalizedDiscovery />
      </div>
    </main>
  );
}
