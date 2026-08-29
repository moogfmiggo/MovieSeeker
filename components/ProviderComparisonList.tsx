import { ProviderBadge } from "@/components/ProviderBadge";
import type { ProviderMatch } from "@/lib/streaming-recommendations";
import { th } from "@/lib/i18n";

/**
 * Row-based (not <table>) comparison list - avoids horizontal scroll on
 * mobile (Phase 3 Part 14). Doubles as Part 4's "alternative providers"
 * listing, since it's the same underlying data at every rank, not just #1 -
 * showing it twice in different shapes would just be repetitive.  Clicking
 * a row switches which provider's matched movies are shown by the caller.
 *
 * Deliberately does not render anything resembling the internal weighted
 * score - only matchCount and coveragePercent, both independently
 * meaningful to a user, ever reach this component.
 */
export function ProviderComparisonList({
  providers,
  selectedProviderId,
  onSelectProvider,
}: {
  providers: ProviderMatch[];
  selectedProviderId: number | null;
  onSelectProvider: (providerId: number) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{th.streamingRecommendation.comparisonTitle}</h2>
      <p className="mt-1 text-xs opacity-60">{th.streamingRecommendation.scoreLabel}</p>
      <div className="mt-3 flex flex-col gap-2">
        {providers.map((match, index) => {
          const isSelected = match.providerId === selectedProviderId;
          return (
            <button
              key={match.providerId}
              type="button"
              onClick={() => onSelectProvider(match.providerId)}
              aria-pressed={isSelected}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition ${
                isSelected
                  ? "border-accent bg-surface-hover"
                  : "border-border bg-surface hover:border-accent-hover"
              }`}
            >
              <span className="shrink-0 text-xs font-semibold opacity-50">#{index + 1}</span>
              <ProviderBadge
                provider={{
                  provider_id: match.providerId,
                  provider_name: match.providerName,
                  logo_path: match.logoPath,
                  display_priority: 0,
                }}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{match.providerName}</p>
                <p className="text-xs opacity-60">{th.streamingRecommendation.matchCount(match.matchCount)}</p>
              </div>
              <div className="w-16 shrink-0 text-right">
                <p className="text-sm font-semibold text-accent">{match.coveragePercent}%</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${match.coveragePercent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
