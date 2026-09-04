import type { TMDBWatchProvider } from "@/types/tmdb";

/** Used only when TMDB's Thailand provider catalog is temporarily unavailable. */
export const FALLBACK_STREAMING_PROVIDERS: TMDBWatchProvider[] = [
  { provider_id: 8, provider_name: "Netflix", logo_path: null, display_priority: 0 },
  { provider_id: 337, provider_name: "Disney+", logo_path: null, display_priority: 1 },
  { provider_id: 9, provider_name: "Prime Video", logo_path: null, display_priority: 2 },
  { provider_id: 350, provider_name: "Apple TV+", logo_path: null, display_priority: 3 },
  { provider_id: 1899, provider_name: "HBO Max", logo_path: null, display_priority: 4 },
];

export function normalizeStreamingProviderIds(raw: unknown): number[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const result: number[] = [];
  const seen = new Set<number>();

  for (const value of values) {
    for (const part of typeof value === "string" ? value.split(",") : [value]) {
      const id = typeof part === "number" ? part : Number(String(part ?? "").trim());
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      if (result.length >= 10) return result;
    }
  }

  return result;
}
