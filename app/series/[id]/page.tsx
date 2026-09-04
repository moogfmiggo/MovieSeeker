import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTVSeriesDetails, getTVWatchProviders, TMDBError } from "@/lib/tmdb";
import { topBilledCast } from "@/lib/credits";
import { summarizeWatchProviders } from "@/lib/watchProviders";
import { PersonCard } from "@/components/PersonCard";
import { WatchProviderSection } from "@/components/WatchProviderSection";
import { th } from "@/lib/i18n";

const BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";
const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const seriesId = parseId((await params).id);
  if (seriesId === null) return { title: th.notFound.title };
  try {
    const series = await getTVSeriesDetails(seriesId);
    return { title: `${series.name} ${th.meta.titleSuffix}` };
  } catch {
    return { title: th.meta.brand };
  }
}

export default async function SeriesDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const seriesId = parseId((await params).id);
  if (seriesId === null) notFound();

  const [seriesResult, providersResult] = await Promise.allSettled([
    getTVSeriesDetails(seriesId),
    getTVWatchProviders(seriesId),
  ]);
  if (seriesResult.status === "rejected") {
    if (seriesResult.reason instanceof TMDBError && seriesResult.reason.status === 404) notFound();
    console.error(
      "[series detail] failed to load series",
      seriesId,
      seriesResult.reason instanceof Error ? seriesResult.reason.message : "unknown error",
    );
    throw new Error("Unable to load this series right now.");
  }

  const series = seriesResult.value;
  const watchProviders = summarizeWatchProviders(
    providersResult.status === "fulfilled" ? providersResult.value : null,
  );
  const cast = topBilledCast(series.credits?.cast);
  const year = series.first_air_date ? new Date(series.first_air_date).getFullYear() : null;

  return (
    <main>
      <div className="relative overflow-hidden bg-background text-foreground">
        {series.backdrop_path && (
          <div className="absolute inset-0">
            <Image
              src={`${BACKDROP_BASE_URL}${series.backdrop_path}`}
              alt=""
              fill
              priority
              className="object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
          </div>
        )}
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:px-6 sm:py-12">
          <div className="w-40 flex-shrink-0 sm:w-56">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface shadow-xl ring-1 ring-border">
              {series.poster_path ? (
                <Image
                  src={`${POSTER_BASE_URL}${series.poster_path}`}
                  alt={`${series.name} poster`}
                  fill
                  sizes="(min-width: 640px) 224px, 160px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-xs opacity-50">
                  {th.common.noPosterAvailable}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">ซีรีส์</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{series.name}</h1>
            {series.tagline && <p className="text-sm italic opacity-70">{series.tagline}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm opacity-80">
              {year && <span>{year}</span>}
              <span>{th.seriesDetail.seasons(series.number_of_seasons)}</span>
              <span>{th.seriesDetail.episodes(series.number_of_episodes)}</span>
              <span className="font-medium text-accent">★ {series.vote_average.toFixed(1)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {series.genres.map((genre) => (
                <span key={genre.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {genre.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {series.overview && (
          <section>
            <h2 className="text-lg font-semibold">{th.seriesDetail.overview}</h2>
            <p className="mt-2 max-w-3xl text-sm opacity-80">{series.overview}</p>
          </section>
        )}
        <WatchProviderSection providers={watchProviders} />
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{th.seriesDetail.cast}</h2>
          {cast.length > 0 ? (
            <div className="cinematic-scrollbar mt-3 flex gap-4 overflow-x-auto pb-4 pr-2">
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
      </div>
    </main>
  );
}
