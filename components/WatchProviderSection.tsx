import { ProviderBadge } from "@/components/ProviderBadge";
import { th } from "@/lib/i18n";
import type { WatchProviderSummary } from "@/lib/watchProviders";
import type { TMDBWatchProvider } from "@/types/tmdb";

function ProviderGroup({ label, providers }: { label: string; providers: TMDBWatchProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</h3>
      <div className="mt-2 flex flex-wrap gap-3">
        {providers.map((provider) => (
          <div key={provider.provider_id} className="flex items-center gap-2">
            <ProviderBadge provider={provider} size={32} />
            <span className="text-sm">{provider.provider_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Movie Detail page's dedicated "ช่องทางการรับชม" section - Streaming / Rent /
 * Buy, clearly separated per Phase 2 Part 3. Shows the Thai empty state
 * rather than guessing when TMDB has no offers for this region.
 */
export function WatchProviderSection({ providers }: { providers: WatchProviderSummary }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{th.streaming.sectionTitle}</h2>
      {providers.hasAny ? (
        <div className="mt-3 flex flex-col gap-4">
          <ProviderGroup label={th.streaming.streaming} providers={providers.streaming} />
          <ProviderGroup label={th.streaming.rent} providers={providers.rent} />
          <ProviderGroup label={th.streaming.buy} providers={providers.buy} />
          {providers.link && (
            <p className="text-xs opacity-50">
              {th.streaming.attribution}{" · "}
              <a
                href={providers.link}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                TMDB
              </a>
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm opacity-60">{th.streaming.notFound}</p>
      )}
    </section>
  );
}
