import Image from "next/image";
import type { TMDBWatchProvider } from "@/types/tmdb";

const PROVIDER_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

/**
 * One streaming/rent/buy provider's logo as a small rounded badge. Falls
 * back to initials when TMDB has no logo for a provider, so a missing image
 * never leaves a blank gap in a row of badges.
 */
export function ProviderBadge({
  provider,
  size = 28,
}: {
  provider: TMDBWatchProvider;
  size?: number;
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface ring-1 ring-border"
      style={{ width: size, height: size }}
      title={provider.provider_name}
    >
      {provider.logo_path ? (
        <Image
          src={`${PROVIDER_LOGO_BASE_URL}${provider.logo_path}`}
          alt={provider.provider_name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="text-[9px] font-semibold uppercase tracking-wide opacity-70"
          aria-label={provider.provider_name}
        >
          {provider.provider_name.slice(0, 2)}
        </span>
      )}
    </span>
  );
}
