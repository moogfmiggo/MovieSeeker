import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPersonDetails, getPersonMovieCredits, getWatchProvidersForMovies, TMDBError } from "@/lib/tmdb";
import { filterDirectingCredits, mergeFilmography } from "@/lib/credits";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { MovieGrid } from "@/components/MovieGrid";
import { th } from "@/lib/i18n";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w342";

// Always fetch live from TMDB at request time — never prerendered at build time.
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/person/[id]">): Promise<Metadata> {
  const { id } = await params;
  const personId = parseId(id);
  if (personId === null) return { title: th.notFound.title };
  try {
    const person = await getPersonDetails(personId);
    return { title: `${person.name} ${th.meta.titleSuffix}` };
  } catch {
    return { title: th.meta.brand };
  }
}

export default async function PersonPage({ params }: PageProps<"/person/[id]">) {
  const { id } = await params;
  const personId = parseId(id);
  if (personId === null) notFound();

  let person;
  let credits;
  try {
    [person, credits] = await Promise.all([
      getPersonDetails(personId),
      getPersonMovieCredits(personId),
    ]);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    console.error(
      "[person] failed to load person",
      personId,
      ":",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load this person right now.");
  }

  const directingCredits = filterDirectingCredits(credits.crew);
  const filmography = mergeFilmography(credits.cast, directingCredits);

  const rawProviders = await getWatchProvidersForMovies(filmography.map((movie) => movie.id));
  const providersByMovieId = summarizeWatchProvidersByMovie(rawProviders);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-40 flex-shrink-0 sm:w-48">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface ring-1 ring-border">
            {person.profile_path ? (
              <Image
                src={`${PROFILE_BASE_URL}${person.profile_path}`}
                alt={person.name}
                fill
                sizes="(min-width: 640px) 192px, 160px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs opacity-50">
                {th.common.noPhotoAvailable}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{person.name}</h1>
          {person.known_for_department && (
            <p className="text-sm opacity-60">
              {th.person.knownFor}: {th.person.department[person.known_for_department] ?? person.known_for_department}
            </p>
          )}
          {person.biography && (
            <p className="mt-2 line-clamp-6 max-w-2xl text-sm opacity-80">{person.biography}</p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{th.person.filmography}</h2>
        <MovieGrid
          movies={filmography}
          emptyMessage={th.person.noMoviesFound}
          providersByMovieId={providersByMovieId}
        />
      </section>
    </main>
  );
}
