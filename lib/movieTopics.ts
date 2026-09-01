export interface MovieTopic {
  slug: string;
  name: string;
  /** Exact English phrase resolved through TMDB's keyword search endpoint. */
  keywordQuery: string;
}

/**
 * TMDB exposes only a small fixed set of top-level movie genres. These
 * curated keyword-backed topics add useful subgenres and themes while still
 * producing real Discover filters instead of cosmetic UI-only categories.
 */
export const MOVIE_TOPICS: readonly MovieTopic[] = [
  { slug: "superhero", name: "ซูเปอร์ฮีโร่", keywordQuery: "superhero" },
  { slug: "zombie", name: "ซอมบี้", keywordQuery: "zombie" },
  { slug: "vampire", name: "แวมไพร์", keywordQuery: "vampire" },
  { slug: "ghost", name: "ผี", keywordQuery: "ghost" },
  { slug: "monster", name: "สัตว์ประหลาด", keywordQuery: "monster" },
  { slug: "time-travel", name: "เดินทางข้ามเวลา", keywordQuery: "time travel" },
  { slug: "dystopia", name: "โลกดิสโทเปีย", keywordQuery: "dystopia" },
  { slug: "space", name: "อวกาศ", keywordQuery: "space" },
  { slug: "artificial-intelligence", name: "ปัญญาประดิษฐ์", keywordQuery: "artificial intelligence" },
  { slug: "spy", name: "สายลับ", keywordQuery: "spy" },
  { slug: "heist", name: "ปล้น", keywordQuery: "heist" },
  { slug: "serial-killer", name: "ฆาตกรต่อเนื่อง", keywordQuery: "serial killer" },
  { slug: "true-story", name: "สร้างจากเรื่องจริง", keywordQuery: "based on true story" },
  { slug: "coming-of-age", name: "ก้าวสู่วัย", keywordQuery: "coming of age" },
  { slug: "christmas", name: "คริสต์มาส", keywordQuery: "christmas" },
  { slug: "martial-arts", name: "ศิลปะการต่อสู้", keywordQuery: "martial arts" },
  { slug: "sports", name: "กีฬา", keywordQuery: "sports" },
  { slug: "survival", name: "เอาตัวรอด", keywordQuery: "survival" },
  { slug: "disaster", name: "ภัยพิบัติ", keywordQuery: "disaster" },
  { slug: "politics", name: "การเมือง", keywordQuery: "politics" },
] as const;

const MAX_SELECTED_TOPICS = 10;
const TOPICS_BY_SLUG = new Map(MOVIE_TOPICS.map((topic) => [topic.slug, topic]));

export function normalizeTopicSlugs(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const part of value.split(",")) {
      const slug = part.trim().toLowerCase();
      if (!TOPICS_BY_SLUG.has(slug) || seen.has(slug)) continue;
      seen.add(slug);
      normalized.push(slug);
      if (normalized.length >= MAX_SELECTED_TOPICS) return normalized;
    }
  }

  return normalized;
}

export function getMovieTopic(slug: string): MovieTopic | undefined {
  return TOPICS_BY_SLUG.get(slug);
}
