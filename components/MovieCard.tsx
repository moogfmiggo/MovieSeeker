import Image from "next/image";
import type { TMDBMovie } from "@/types/tmdb";

const POSTER_BASE_URL = "https://image.tmdb.org/t/p/w342";

function formatReleaseDate(releaseDate: string): string {
  if (!releaseDate) return "Release date unknown";
  const parsed = new Date(releaseDate);
  if (Number.isNaN(parsed.getTime())) return "Release date unknown";
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MovieCard({ movie }: { movie: TMDBMovie }) {
  return (
    <article className="flex flex-col">
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-black/10">
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
            <span>No poster available</span>
          </div>
        )}
      </div>
      <h2 className="mt-2 line-clamp-2 text-sm font-semibold">{movie.title}</h2>
      <p className="text-xs opacity-60">{formatReleaseDate(movie.release_date)}</p>
      <p className="mt-1 line-clamp-3 text-xs opacity-80">
        {movie.overview ? movie.overview : "No description available."}
      </p>
    </article>
  );
}
