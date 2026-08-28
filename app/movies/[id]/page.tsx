import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getMovieDetails, getWatchProviders, TMDBError } from "@/lib/tmdb";
import { topBilledCast, movieDirectors } from "@/lib/credits";
import { summarizeWatchProviders } from "@/lib/watchProviders";
import { PersonCard } from "@/components/PersonCard";
import { CompanyCard } from "@/components/CompanyCard";
import { WatchedButton } from "@/components/WatchedButton";
import { WatchProviderSection } from "@/components/WatchProviderSection";
import { th } from "@/lib/i18n";

const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

// Always fetch live from TMDB at request time — never prerendered at build time.
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function releaseYear(releaseDate: string): string | null {
  if (!releaseDate) return null;
  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? null : String(parsed.getFullYear());
}

export async function generateMetadata({
  params,
}: PageProps<"/movies/[id]">): Promise<Metadata> {
  const { id } = await params;
  const movieId = parseId(id);
  if (movieId === null) return { title: th.notFound.title };
  try {
    const movie = await getMovieDetails(movieId);
    return { title: `${movie.title} ${th.meta.titleSuffix}` };
  } catch {
    return { title: th.meta.brand };
  }
}

export default async function MovieDetailPage({ params }: PageProps<"/movies/[id]">) {
  const { id } = await params;
  const movieId = parseId(id);
  if (movieId === null) notFound();

  const [movieResult, providersResult] = await Promise.allSettled([
    getMovieDetails(movieId),
    getWatchProviders(movieId),
  ]);

  let movie;
  if (movieResult.status === "fulfilled") {
    movie = movieResult.value;
  } else {
    const error = movieResult.reason;
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    // Full detail (still token-free) goes to server logs only. The client
    // only ever sees the generic message thrown below, via error.tsx.
    console.error(
      "[movie detail] failed to load movie",
      movieId,
      ":",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load this movie right now.");
  }

  // A failed provider lookup degrades to the "no streaming info" empty state
  // (Part 1) instead of failing the whole page - the movie itself loaded fine.
  if (providersResult.status === "rejected") {
    console.error(
      "[movie detail] failed to load watch providers",
      movieId,
      ":",
      providersResult.reason instanceof Error ? providersResult.reason.message : "unknown error",
    );
  }
  const watchProviders = summarizeWatchProviders(
    providersResult.status === "fulfilled" ? providersResult.value : null,
  );

  const cast = topBilledCast(movie.credits?.cast);
  const directorList = movieDirectors(movie.credits?.crew);
  const year = releaseYear(movie.release_date);

  return (
    <main>
      <div className="relative overflow-hidden bg-neutral-900 text-white">
        {movie.backdrop_path && (
          <div className="absolute inset-0">
            <Image
              src={`${BACKDROP_BASE_URL}${movie.backdrop_path}`}
              alt=""
              fill
              priority
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/80 to-neutral-900/40" />
          </div>
        )}
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:px-6 sm:py-12">
          <div className="w-40 flex-shrink-0 sm:w-56">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-black/30 shadow-xl">
              {movie.poster_path ? (
                <Image
                  src={`${POSTER_BASE_URL}${movie.poster_path}`}
                  alt={`${movie.title} poster`}
                  fill
                  sizes="(min-width: 640px) 224px, 160px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs opacity-50">
                  {th.common.noPosterAvailable}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{movie.title}</h1>
            {movie.tagline && <p className="text-sm italic opacity-70">{movie.tagline}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-80">
              {year && <span>{year}</span>}
              {movie.runtime ? <span>{formatRuntime(movie.runtime)}</span> : null}
              <span>★ {movie.vote_average.toFixed(1)}</span>
            </div>
            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
                  <span key={genre.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    {genre.name}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2">
              <WatchedButton movieId={movie.id} />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {movie.overview && (
          <section>
            <h2 className="text-lg font-semibold">{th.movieDetail.overview}</h2>
            <p className="mt-2 max-w-3xl text-sm opacity-80">{movie.overview}</p>
          </section>
        )}

        <WatchProviderSection providers={watchProviders} />

        {directorList.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">{th.movieDetail.director}</h2>
            <div className="mt-3 flex flex-wrap gap-4">
              {directorList.map((director) => (
                <PersonCard
                  key={director.id}
                  id={director.id}
                  name={director.name}
                  role={th.movieDetail.director}
                  profilePath={director.profile_path}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">{th.movieDetail.cast}</h2>
          {cast.length > 0 ? (
            <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
              {cast.map((member) => (
                <PersonCard
                  key={member.id}
                  id={member.id}
                  name={member.name}
                  role={member.character}
                  profilePath={member.profile_path}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-60">{th.movieDetail.noCastInfo}</p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">{th.movieDetail.production}</h2>
          {movie.production_companies.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {movie.production_companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  id={company.id}
                  name={company.name}
                  logoPath={company.logo_path}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm opacity-60">{th.movieDetail.noProductionInfo}</p>
          )}
        </section>
      </div>
    </main>
  );
}
