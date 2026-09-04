import Image from "next/image";
import Link from "next/link";
import type { TMDBMovie } from "@/types/tmdb";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import { topProvidersForCard } from "@/lib/watchProviders";
import { ProviderBadge } from "@/components/ProviderBadge";
import { th } from "@/lib/i18n";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

/** Filled when favorited, outline otherwise - the visual state must be obvious at a glance. */
function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20.5s-7.5-4.6-10-9.1C.5 7.8 2.4 4.5 5.8 4c2.1-.3 4.1.8 6.2 3.2C14.1 4.8 16.1 3.7 18.2 4c3.4.5 5.3 3.8 3.8 7.4-2.5 4.5-10 9.1-10 9.1z" />
    </svg>
  );
}

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
  isFavorited,
  onToggleFavorite,
  providers,
  matchScore,
  matchReason,
  showActions = true,
  onDismiss,
}: {
  movie: TMDBMovie;
  isWatched: boolean;
  onToggleWatched: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  /** Omitted entirely (not an empty state) when there's no data - see the streaming row below. */
  providers?: WatchProviderSummary;
  /** Phase 4 Part 7 - "personalization match" 0-100. Omitted entirely outside personalized sections. */
  matchScore?: number;
  /** Phase 4 Part 6 - the single strongest reason, already resolved to Thai text. */
  matchReason?: string;
  /** Can be disabled for a read-only surface; movie and series lists normally enable it. */
  showActions?: boolean;
  /** Recommendation-only negative feedback; omitted from ordinary search/catalog cards. */
  onDismiss?: () => void;
}) {
  const { visible: providerBadges, moreCount } = providers
    ? topProvidersForCard(providers)
    : { visible: [], moreCount: 0 };
  const detailHref = movie.media_type === "tv" ? `/series/${movie.id}` : `/movies/${movie.id}`;

  return (
    <article className="flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface ring-1 ring-border">
        {showActions && <button
          type="button"
          onClick={(event) => {
            // This button is a sibling of the poster Link below, not nested
            // inside it, so it can't trigger navigation structurally - but
            // stop propagation anyway as explicit, robust protection against
            // an accidental "click through" to the card underneath.
            event.stopPropagation();
            onToggleFavorite();
          }}
          aria-pressed={isFavorited}
          aria-label={isFavorited ? th.favorite.removeLabel(movie.title) : th.favorite.addLabel(movie.title)}
          title={isFavorited ? th.favorite.removeLabel(movie.title) : th.favorite.addLabel(movie.title)}
          className={`absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow transition ${
            isFavorited
              ? "bg-accent text-accent-foreground"
              : "bg-black/60 text-white backdrop-blur-sm hover:bg-black/75"
          }`}
        >
          <HeartIcon filled={isFavorited} />
        </button>}
        {showActions && <button
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
        </button>}
        <Link
          href={detailHref}
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
      <Link href={detailHref} className="mt-2 block">
        <h2 className="line-clamp-2 text-sm font-semibold hover:underline">{movie.title}</h2>
      </Link>
      {movie.media_type === "tv" && (
        <span className="mt-1 w-fit rounded-full border border-accent/40 px-2 py-0.5 text-[10px] font-semibold text-accent">
          {th.common.seriesLabel}
        </span>
      )}
      {typeof matchScore === "number" && (
        <span className="mt-1 inline-block w-fit rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
          {th.home.matchScore(matchScore)}
        </span>
      )}
      {matchReason && <p className="mt-1 line-clamp-2 text-[11px] opacity-70">{matchReason}</p>}
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
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={th.dismissed.label(movie.title)}
          className="mt-3 w-fit text-xs opacity-60 underline decoration-transparent underline-offset-2 transition hover:text-accent hover:decoration-current hover:opacity-100"
        >
          {th.dismissed.action}
        </button>
      )}
    </article>
  );
}
