import { FALLBACK_GENRES, FALLBACK_TV_GENRES } from "./genres";
import {
  getMovieGenreSearchTerms,
  getSeriesGenreSearchTerms,
  normalizeGenreSearchText,
} from "./genreSearch";
import { buildMovieSearchHref, normalizeGenreIds } from "./movieSearch";
import { MOVIE_TOPICS, normalizeTopicSlugs } from "./movieTopics";
import { normalizeStreamingProviderIds } from "./streamingProviders";
import {
  getSemanticConstraintTaxonomy,
  normalizeSemanticConstraints,
  SEMANTIC_CONSTRAINTS,
  type SemanticConstraintSlug,
} from "./semantic/constraints";

export type SearchMediaType = "movie" | "tv";
export type SearchIntentSource = "ai" | "genre-fallback";

export interface NaturalSearchIntent {
  mediaType: SearchMediaType;
  genreIds: number[];
  topicSlugs: string[];
  originCountry?: string;
  /** Story conditions that require semantic research after catalog filtering. */
  semanticConstraints: SemanticConstraintSlug[];
}

interface OriginCountryDefinition {
  code: string;
  name: string;
  aliases: readonly string[];
}

const ORIGIN_COUNTRIES: readonly OriginCountryDefinition[] = [
  { code: "KR", name: "เกาหลีใต้", aliases: ["เกาหลี", "เกาหลีใต้", "korea", "korean", "south korea"] },
  { code: "JP", name: "ญี่ปุ่น", aliases: ["ญี่ปุ่น", "japan", "japanese"] },
  { code: "TH", name: "ไทย", aliases: ["ไทย", "ประเทศไทย", "thailand", "thai"] },
  { code: "CN", name: "จีน", aliases: ["จีน", "จีนแผ่นดินใหญ่", "china", "chinese"] },
  { code: "HK", name: "ฮ่องกง", aliases: ["ฮ่องกง", "hong kong"] },
  { code: "IN", name: "อินเดีย", aliases: ["อินเดีย", "บอลลีวูด", "india", "indian", "bollywood"] },
  { code: "US", name: "อเมริกา", aliases: ["อเมริกา", "สหรัฐ", "ฮอลลีวูด", "usa", "american", "hollywood"] },
  { code: "GB", name: "อังกฤษ", aliases: ["อังกฤษ", "สหราชอาณาจักร", "british", "united kingdom", "uk"] },
] as const;

const SERIES_TERMS = ["ซีรีส์", "ซีรี่ส์", "ซีรี่", "ซีรีย์", "ละครชุด", "tv series", "series", "tv show"];
const MOVIE_TERMS = ["ภาพยนตร์", "หนัง", "movie", "film"];
const ROMANTIC_COMEDY_TERMS = [
  "โรแมนติกคอมเมดี้",
  "โรแมนติก คอมเมดี้",
  "โรแมนซ์คอมเมดี้",
  "รอมคอม",
  "romantic comedy",
  "romcom",
  "rom com",
];

/** Broad topic aliases are helpful in autocomplete but too ambiguous for automatic filtering. */
const AMBIGUOUS_TOPIC_ALIASES = new Set(
  [
    "สงคราม",
    "สงครามโลก",
    "เรื่องจริง",
    "อดีต",
    "อนาคต",
    "หลอน",
    "เดินทาง",
    "อวกาศ",
    "ครอบครัว",
    "ความสัมพันธ์",
    "สัตว์",
    "ทะเล",
    "ai",
  ].map(normalizeGenreSearchText),
);

function containsTerm(normalizedQuery: string, rawTerm: string): boolean {
  const term = normalizeGenreSearchText(rawTerm);
  if (!term) return false;

  // Latin aliases should match whole words/phrases ("war" must not match
  // "award"). Thai is normally written without word separators, so a
  // substring check is the useful behavior there.
  if (/^[a-z0-9 ]+$/.test(term)) {
    return ` ${normalizedQuery} `.includes(` ${term} `);
  }
  return normalizedQuery.includes(term);
}

function containsAny(normalizedQuery: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsTerm(normalizedQuery, term));
}

function inferMediaType(query: string, preferred: SearchMediaType): SearchMediaType {
  const mentionsSeries = containsAny(query, SERIES_TERMS);
  const mentionsMovie = containsAny(query, MOVIE_TERMS);
  if (mentionsSeries !== mentionsMovie) return mentionsSeries ? "tv" : "movie";
  return preferred;
}

function inferGenreIds(query: string, mediaType: SearchMediaType): number[] {
  const genres = mediaType === "tv" ? FALLBACK_TV_GENRES : FALLBACK_GENRES;
  const aliases = mediaType === "tv" ? getSeriesGenreSearchTerms : getMovieGenreSearchTerms;
  const selected = genres
    .filter((genre) => containsAny(query, [genre.name, ...aliases(genre.id)]))
    .map((genre) => genre.id);

  if (containsAny(query, ROMANTIC_COMEDY_TERMS)) {
    selected.push(35);
    if (mediaType === "movie") selected.push(10749);
  }
  return normalizeGenreIds(selected);
}

function inferTopicSlugs(query: string, mediaType: SearchMediaType): string[] {
  const matched = MOVIE_TOPICS.filter((topic) => {
    if (topic.slug === "romantic-comedy") {
      return mediaType === "tv" && containsAny(query, ROMANTIC_COMEDY_TERMS);
    }

    const directTerms = [topic.name, topic.keywordQuery, topic.slug];
    if (containsAny(query, directTerms)) return true;
    return (topic.aliases ?? []).some(
      (alias) =>
        !AMBIGUOUS_TOPIC_ALIASES.has(normalizeGenreSearchText(alias)) &&
        containsTerm(query, alias),
    );
  }).map((topic) => topic.slug);

  return normalizeTopicSlugs(matched);
}

function inferOriginCountry(query: string): string | undefined {
  return ORIGIN_COUNTRIES.find((country) => containsAny(query, country.aliases))?.code;
}

function inferSemanticConstraints(query: string): SemanticConstraintSlug[] {
  const matched = new Set(
    SEMANTIC_CONSTRAINTS.filter((constraint) => containsAny(query, constraint.aliases)).map(
      (constraint) => constraint.slug,
    ),
  );

  // A negated condition is more specific than its positive substring. This
  // matters for phrases such as "ไม่มีสัตว์ตาย", which must never request
  // both animal_death=true and animal_death=false.
  if (matched.has("no_protagonist_death")) matched.delete("protagonist_death");
  if (matched.has("no_animal_death")) matched.delete("animal_death");

  return normalizeSemanticConstraints([...matched]);
}

export function interpretNaturalSearchFallback(
  rawQuery: unknown,
  preferredMediaType: SearchMediaType = "movie",
): NaturalSearchIntent {
  const query = normalizeGenreSearchText(rawQuery);
  const mediaType = inferMediaType(query, preferredMediaType);
  return {
    mediaType,
    genreIds: inferGenreIds(query, mediaType),
    topicSlugs: inferTopicSlugs(query, mediaType),
    originCountry: inferOriginCountry(query),
    semanticConstraints: inferSemanticConstraints(query),
  };
}

export interface NaturalSearchTaxonomy {
  movieGenres: Array<{ id: number; name: string; aliases: readonly string[] }>;
  seriesGenres: Array<{ id: number; name: string; aliases: readonly string[] }>;
  topics: Array<{ slug: string; name: string; aliases: readonly string[] }>;
  originCountries: Array<{ code: string; name: string; aliases: readonly string[] }>;
  semanticConstraints: ReturnType<typeof getSemanticConstraintTaxonomy>;
}

export function getNaturalSearchTaxonomy(): NaturalSearchTaxonomy {
  return {
    movieGenres: FALLBACK_GENRES.map((genre) => ({
      ...genre,
      aliases: getMovieGenreSearchTerms(genre.id),
    })),
    seriesGenres: FALLBACK_TV_GENRES.map((genre) => ({
      ...genre,
      aliases: getSeriesGenreSearchTerms(genre.id),
    })),
    topics: MOVIE_TOPICS.map((topic) => ({
      slug: topic.slug,
      name: topic.name,
      aliases: [topic.keywordQuery, ...(topic.aliases ?? [])],
    })),
    originCountries: ORIGIN_COUNTRIES.map((country) => ({ ...country })),
    semanticConstraints: getSemanticConstraintTaxonomy(),
  };
}

export function validateAiSearchIntent(
  raw: unknown,
  fallback: NaturalSearchIntent,
): NaturalSearchIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const mediaType: SearchMediaType = candidate.mediaType === "tv"
    ? "tv"
    : candidate.mediaType === "movie"
      ? "movie"
      : fallback.mediaType;
  const validGenreIds = new Set(
    (mediaType === "tv" ? FALLBACK_TV_GENRES : FALLBACK_GENRES).map((genre) => genre.id),
  );
  const genreIds = normalizeGenreIds(candidate.genreIds).filter((id) => validGenreIds.has(id));
  const topicSlugs = normalizeTopicSlugs(candidate.topicSlugs);
  const aiSemanticConstraints = normalizeSemanticConstraints(candidate.semanticConstraints);

  // The deterministic Genre interpreter remains authoritative whenever it
  // found a catalog filter. A small local model may otherwise add a plausible
  // but unrequested Genre, which would make an AND search incorrectly empty.
  // AI may supply catalog filters only when the fallback found none at all.
  const hasDeterministicCatalogFilters =
    fallback.genreIds.length > 0 || fallback.topicSlugs.length > 0;
  return {
    mediaType,
    genreIds: hasDeterministicCatalogFilters ? fallback.genreIds : genreIds,
    topicSlugs: hasDeterministicCatalogFilters ? fallback.topicSlugs : topicSlugs,
    // Country is a precise catalog filter. Only keep it when the deterministic
    // interpreter found an explicit country alias in the user's own query;
    // a small model must never invent a production country from story context.
    originCountry: fallback.originCountry,
    semanticConstraints: normalizeSemanticConstraints([
      ...fallback.semanticConstraints,
      ...aiSemanticConstraints,
    ]),
  };
}

export function buildNaturalSearchHref(
  intent: NaturalSearchIntent,
  rawQuery: unknown,
  source: SearchIntentSource,
  providerIds: unknown = [],
): string {
  const baseHref = buildMovieSearchHref(
    intent.mediaType === "movie" ? intent.genreIds : [],
    intent.mediaType === "movie" ? intent.topicSlugs : [],
    normalizeStreamingProviderIds(providerIds),
    intent.mediaType === "tv" ? intent.genreIds : [],
    intent.mediaType === "tv" ? intent.topicSlugs : [],
  );
  const [pathname, rawParams = ""] = baseHref.split("?");
  const params = new URLSearchParams(rawParams);
  const query = typeof rawQuery === "string" ? rawQuery.trim().slice(0, 300) : "";
  params.set("media", intent.mediaType);
  params.set("mode", source);
  if (query) params.set("q", query);
  if (intent.originCountry) params.set("origin", intent.originCountry);
  if (intent.semanticConstraints.length > 0) {
    params.set("semantics", intent.semanticConstraints.join(","));
  }
  return `${pathname}?${params.toString()}`;
}
