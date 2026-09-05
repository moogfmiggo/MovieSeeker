const MOVIE_GENRE_ALIASES: Readonly<Record<number, readonly string[]>> = {
  12: ["adventure", "เดินทาง", "ผจญภัย"],
  14: ["fantasy", "เวทมนตร์", "เทพนิยาย"],
  16: ["animation", "anime", "การ์ตูน"],
  18: ["drama", "ชีวิต"],
  27: ["horror", "ผี", "หลอน", "น่ากลัว"],
  28: ["action", "บู๊"],
  35: ["comedy", "ขำ", "ตลกขบขัน"],
  36: ["history", "historical", "ย้อนยุค", "อดีต"],
  37: ["western"],
  53: ["thriller"],
  80: ["crime", "ตำรวจ", "อาชญากร"],
  99: ["documentary", "เรื่องจริง", "สารคดีธรรมชาติ"],
  878: ["science fiction", "sci-fi", "scifi", "ไซไฟ"],
  9648: ["mystery", "สืบสวน", "ไขคดี"],
  10402: ["music", "musical"],
  10749: ["romance", "romantic", "รัก", "ความรัก"],
  10751: ["family", "เด็ก", "ครอบครัว"],
  10752: ["war", "ทหาร", "กองทัพ", "สงครามโลก"],
  10770: ["tv movie", "television movie"],
};

const SERIES_GENRE_ALIASES: Readonly<Record<number, readonly string[]>> = {
  16: ["animation", "anime", "การ์ตูน"],
  18: ["drama", "ชีวิต"],
  35: ["comedy", "ขำ", "ตลกขบขัน"],
  37: ["western"],
  80: ["crime", "ตำรวจ", "อาชญากร"],
  99: ["documentary", "เรื่องจริง"],
  9648: ["mystery", "สืบสวน", "ไขคดี"],
  10751: ["family", "เด็ก", "ครอบครัว"],
  10759: ["action adventure", "action", "adventure", "บู๊"],
  10762: ["kids", "children"],
  10763: ["news"],
  10764: ["reality", "reality tv"],
  10765: ["science fiction fantasy", "sci-fi", "scifi", "fantasy", "ไซไฟ", "โลกอนาคต", "เวทมนตร์"],
  10766: ["soap", "soap opera"],
  10767: ["talk", "talk show"],
  10768: ["war politics", "war", "politics", "สงครามโลก", "ทหาร", "การเมือง"],
};

export function normalizeGenreSearchText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .toLocaleLowerCase("th-TH")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesGenreSearch(query: unknown, terms: readonly unknown[]): boolean {
  const normalizedQuery = normalizeGenreSearchText(query);
  if (!normalizedQuery) return false;

  const haystack = terms
    .map(normalizeGenreSearchText)
    .filter(Boolean)
    .join(" ");

  return normalizedQuery.split(" ").every((token) => haystack.includes(token));
}

export function getMovieGenreSearchTerms(id: number): readonly string[] {
  return MOVIE_GENRE_ALIASES[id] ?? [];
}

export function getSeriesGenreSearchTerms(id: number): readonly string[] {
  return SERIES_GENRE_ALIASES[id] ?? [];
}
