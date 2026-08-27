import Image from "next/image";
import Link from "next/link";

const LOGO_BASE_URL = "https://image.tmdb.org/t/p/w185";

/** A clickable production company entity - logo (when available) and name. */
export function CompanyCard({
  id,
  name,
  logoPath,
}: {
  id: number;
  name: string;
  logoPath: string | null;
}) {
  return (
    <Link
      href={`/company/${id}`}
      className="group flex w-32 flex-shrink-0 flex-col items-center gap-2 rounded-lg border border-black/10 p-3 text-center transition hover:border-black/20"
    >
      <div className="flex h-12 w-full items-center justify-center">
        {logoPath ? (
          <Image
            src={`${LOGO_BASE_URL}${logoPath}`}
            alt={name}
            width={100}
            height={48}
            className="max-h-12 w-auto object-contain"
          />
        ) : (
          <span className="text-xs opacity-40">No logo</span>
        )}
      </div>
      <span className="line-clamp-2 text-xs font-medium group-hover:underline">{name}</span>
    </Link>
  );
}
