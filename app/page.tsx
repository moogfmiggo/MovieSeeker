import { PersonalizedDiscovery } from "@/components/PersonalizedDiscovery";
import { GenreSearchPanel } from "@/components/GenreSearchPanel";
import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { FALLBACK_GENRES } from "@/lib/genres";
import type { TMDBGenre } from "@/types/tmdb";

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
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <GenreSearchPanel genres={genres} />

      <div className="mt-10">
        <PersonalizedDiscovery />
      </div>
    </main>
  );
}
