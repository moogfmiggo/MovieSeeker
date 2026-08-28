import Image from "next/image";
import Link from "next/link";
import { th } from "@/lib/i18n";

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
      className="group flex w-32 flex-shrink-0 flex-col items-center gap-2 rounded-lg border border-border p-3 text-center transition hover:border-border-strong"
    >
      <div className="flex h-12 w-full items-center justify-center rounded bg-foreground/95 px-2">
        {logoPath ? (
          <Image
            src={`${LOGO_BASE_URL}${logoPath}`}
            alt={name}
            width={100}
            height={48}
            className="max-h-9 w-auto object-contain"
          />
        ) : (
          <span className="text-xs text-background/50">{th.common.noLogo}</span>
        )}
      </div>
      <span className="line-clamp-2 text-xs font-medium group-hover:underline">{name}</span>
    </Link>
  );
}
