import Image from "next/image";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { topProvidersForCard } from "@/lib/watchProviders";
import { ProviderBadge } from "@/components/ProviderBadge";
import { th } from "@/lib/i18n";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

function formatReleaseDate(releaseDate: string): string {
  if (!releaseDate) return th.common.releaseDateUnknown;
  const parsed = new Date(releaseDate);
  if (Number.isNaN(parsed.getTime())) return th.common.releaseDateUnknown;
  // th-TH-u-ca-gregory: Thai month names, but Gregorian year (not Buddhist
  // Era +543) - movie release years read oddly in BE even in Thai UI.
  return parsed.toLocaleDateString("th-TH-u-ca-gregory", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MovieCard({
  movie,
  isWatched,
  onToggleWatched,
  providers,
}: {
  movie: TMDBMovie;
  isWatched: boolean;
  onToggleWatched: () => void;
  /** Omitted entirely (not an empty state) when there's no data - see the streaming row below. */
  providers?: WatchProviderSummary;
}) {
  const { visible: providerBadges, moreCount } = providers
    ? topProvidersForCard(providers)
    : { visible: [], moreCount: 0 };

  return (
    <article className="flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface ring-1 ring-border">
        <button
          type="button"
          onClick={onToggleWatched}
          aria-pressed={isWatched}
          className={`absolute right-2 top-2 z-10 rounded-full px-3 py-1 text-xs font-medium shadow transition ${
            isWatched
              ? "bg-accent text-accent-foreground"
              : "bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
          }`}
        >
          {isWatched ? th.watched.watched : th.watched.markWatched}
        </button>
        <Link
          href={`/movies/${movie.id}`}
          className="block h-full w-full"
          aria-label={th.common.viewDetailsFor(movie.title)}
        >
          {movie.poster_path ? (
            <Image
              src={`${POSTER_BASE_URL}${movie.poster_path}`}
              alt={`${movie.title} poster`}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs opacity-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="h-8 w-8"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span>{th.common.noPosterAvailable}</span>
            </div>
          )}
        </Link>
      </div>
      <Link href={`/movies/${movie.id}`} className="mt-2 block">
        <h2 className="line-clamp-2 text-sm font-semibold hover:underline">{movie.title}</h2>
      </Link>
      <p className="text-xs opacity-60">{formatReleaseDate(movie.release_date)}</p>
      <p className="mt-1 line-clamp-3 text-xs opacity-80">
        {movie.overview ? movie.overview : th.common.noDescription}
      </p>
      {providerBadges.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
          <span className="shrink-0 text-[11px] font-medium opacity-60">{th.streaming.whereToWatch}</span>
          <div className="flex items-center gap-1">
            {providerBadges.map((provider) => (
              <ProviderBadge key={provider.provider_id} provider={provider} size={22} />
            ))}
          </div>
          {moreCount > 0 && (
            <span className="shrink-0 text-[11px] font-medium opacity-50">{th.streaming.more(moreCount)}</span>
          )}
        </div>
      )}
    </article>
  );
}
