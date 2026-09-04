export type TitleSearchMediaType = "movie" | "tv";

const MAX_QUERY_LENGTH = 100;

/** Normalizes URL/form input without allowing an unbounded TMDB query. */
export function normalizeTitleSearchQuery(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_QUERY_LENGTH);
}

/** Movies remain the default; TV must always be an explicit user choice. */
export function normalizeTitleSearchMediaType(raw: unknown): TitleSearchMediaType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "tv" ? "tv" : "movie";
}

export function buildTitleSearchHref(query: unknown, mediaType: unknown = "movie"): string {
  const normalizedQuery = normalizeTitleSearchQuery(query);
  const normalizedMediaType = normalizeTitleSearchMediaType(mediaType);
  if (!normalizedQuery) return "/search";
  const params = new URLSearchParams({ q: normalizedQuery, mediaType: normalizedMediaType });
  return `/search?${params.toString()}`;
}

export function buildTitleSearchFeedApiHref(
  page: unknown,
  query: unknown,
  mediaType: unknown = "movie",
): string {
  const parsedPage = typeof page === "number" ? page : Number(page);
  const normalizedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0
    ? Math.min(parsedPage, 500)
    : 1;
  const params = new URLSearchParams({
    page: String(normalizedPage),
    mediaType: normalizeTitleSearchMediaType(mediaType),
    query: normalizeTitleSearchQuery(query),
  });
  return `/api/tmdb/feed?${params.toString()}`;
}
