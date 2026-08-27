import Image from "next/image";
import Link from "next/link";

const PROFILE_BASE_URL = "https://image.tmdb.org/t/p/w185";

/** A clickable person entity (actor or director) - photo, name, and their role on this movie. */
export function PersonCard({
  id,
  name,
  role,
  profilePath,
}: {
  id: number;
  name: string;
  role?: string | null;
  profilePath: string | null;
}) {
  return (
    <Link
      href={`/person/${id}`}
      className="group flex w-24 flex-shrink-0 flex-col items-center text-center sm:w-28"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-full bg-black/10">
        {profilePath ? (
          <Image
            src={`${PROFILE_BASE_URL}${profilePath}`}
            alt={name}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center opacity-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-8 w-8"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
            </svg>
          </div>
        )}
      </div>
      <span className="mt-2 line-clamp-2 text-xs font-medium group-hover:underline">{name}</span>
      {role && <span className="line-clamp-1 text-[11px] opacity-60">{role}</span>}
    </Link>
  );
}
