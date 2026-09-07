export interface MovieTopic {
  slug: string;
  name: string;
  /** Exact English phrase resolved through TMDB's keyword search endpoint. */
  keywordQuery: string;
  /** Thai/English synonyms used only to make the selector easier to search. */
  aliases?: readonly string[];
}

/**
 * TMDB exposes only a small fixed set of top-level movie genres. These
 * curated keyword-backed topics add useful subgenres and themes while still
 * producing real Discover filters instead of cosmetic UI-only categories.
 */
export const MOVIE_TOPICS: readonly MovieTopic[] = [
  { slug: "romantic-comedy", name: "โรแมนติกคอมเมดี้", keywordQuery: "romantic comedy", aliases: ["รอมคอม", "romcom", "rom-com"] },
  { slug: "superhero", name: "ซูเปอร์ฮีโร่", keywordQuery: "superhero", aliases: ["ฮีโร่", "ยอดมนุษย์"] },
  { slug: "zombie", name: "ซอมบี้", keywordQuery: "zombie" },
  { slug: "vampire", name: "แวมไพร์", keywordQuery: "vampire" },
  { slug: "ghost", name: "ผี", keywordQuery: "ghost", aliases: ["วิญญาณ", "หลอน"] },
  { slug: "monster", name: "สัตว์ประหลาด", keywordQuery: "monster" },
  { slug: "time-travel", name: "เดินทางข้ามเวลา", keywordQuery: "time travel", aliases: ["ย้อนเวลา", "อนาคต", "อดีต"] },
  { slug: "dystopia", name: "โลกดิสโทเปีย", keywordQuery: "dystopia" },
  { slug: "space", name: "อวกาศ", keywordQuery: "space" },
  { slug: "artificial-intelligence", name: "ปัญญาประดิษฐ์", keywordQuery: "artificial intelligence", aliases: ["เอไอ", "AI"] },
  { slug: "spy", name: "สายลับ", keywordQuery: "spy", aliases: ["จารชน", "หน่วยข่าวกรอง"] },
  { slug: "heist", name: "ปล้น", keywordQuery: "heist", aliases: ["โจรกรรม", "ขโมย"] },
  { slug: "serial-killer", name: "ฆาตกรต่อเนื่อง", keywordQuery: "serial killer" },
  { slug: "true-story", name: "สร้างจากเรื่องจริง", keywordQuery: "based on true story", aliases: ["เรื่องจริง", "ชีวประวัติ"] },
  { slug: "coming-of-age", name: "ก้าวสู่วัย", keywordQuery: "coming of age" },
  { slug: "christmas", name: "คริสต์มาส", keywordQuery: "christmas" },
  { slug: "martial-arts", name: "ศิลปะการต่อสู้", keywordQuery: "martial arts" },
  { slug: "sports", name: "กีฬา", keywordQuery: "sports" },
  { slug: "survival", name: "เอาตัวรอด", keywordQuery: "survival" },
  { slug: "disaster", name: "ภัยพิบัติ", keywordQuery: "disaster" },
  { slug: "politics", name: "การเมือง", keywordQuery: "politics" },
  { slug: "world-war-i", name: "สงครามโลกครั้งที่ 1", keywordQuery: "world war i", aliases: ["สงครามโลก", "สงครามโลกครั้งที่หนึ่ง", "WWI", "WW1"] },
  { slug: "world-war-ii", name: "สงครามโลกครั้งที่ 2", keywordQuery: "world war ii", aliases: ["สงครามโลก", "สงครามโลกครั้งที่สอง", "WWII", "WW2"] },
  { slug: "cold-war", name: "สงครามเย็น", keywordQuery: "cold war", aliases: ["สงคราม", "รัสเซีย", "โซเวียต"] },
  { slug: "vietnam-war", name: "สงครามเวียดนาม", keywordQuery: "vietnam war", aliases: ["สงคราม", "เวียดนาม"] },
  { slug: "military", name: "ทหารและกองทัพ", keywordQuery: "military", aliases: ["สงคราม", "กองทัพ", "ทหาร"] },
  { slug: "detective", name: "นักสืบ", keywordQuery: "detective", aliases: ["สืบสวน", "ไขคดี", "ตำรวจ"] },
  { slug: "courtroom", name: "ศาลและคดีความ", keywordQuery: "courtroom", aliases: ["กฎหมาย", "ทนาย", "พิจารณาคดี"] },
  { slug: "prison", name: "คุกและเรือนจำ", keywordQuery: "prison", aliases: ["นักโทษ", "แหกคุก"] },
  { slug: "mafia", name: "มาเฟีย", keywordQuery: "mafia", aliases: ["แก๊ง", "อาชญากรรม", "เจ้าพ่อ"] },
  { slug: "revenge", name: "ล้างแค้น", keywordQuery: "revenge", aliases: ["แก้แค้น", "เอาคืน"] },
  { slug: "conspiracy", name: "ทฤษฎีสมคบคิด", keywordQuery: "conspiracy", aliases: ["สมคบคิด", "ความลับ"] },
  { slug: "psychological", name: "จิตวิทยา", keywordQuery: "psychological", aliases: ["จิตใจ", "หลอน", "หักมุม"] },
  { slug: "slasher", name: "ฆาตกรไล่เชือด", keywordQuery: "slasher", aliases: ["ไล่ฆ่า", "สยองขวัญ"] },
  { slug: "alien", name: "มนุษย์ต่างดาว", keywordQuery: "alien", aliases: ["เอเลี่ยน", "ต่างดาว", "อวกาศ"] },
  { slug: "robot", name: "หุ่นยนต์", keywordQuery: "robot", aliases: ["จักรกล", "แอนดรอยด์", "AI"] },
  { slug: "cyberpunk", name: "ไซเบอร์พังก์", keywordQuery: "cyberpunk", aliases: ["โลกอนาคต", "เทคโนโลยี"] },
  { slug: "mythology", name: "เทพปกรณัม", keywordQuery: "mythology", aliases: ["ตำนาน", "เทพเจ้า"] },
  { slug: "pirate", name: "โจรสลัด", keywordQuery: "pirate", aliases: ["ทะเล", "เรือ", "สมบัติ"] },
  { slug: "road-movie", name: "เดินทางบนถนน", keywordQuery: "road movie", aliases: ["โรดทริป", "เดินทาง", "ท่องเที่ยว"] },
  { slug: "cooking", name: "อาหารและการทำครัว", keywordQuery: "cooking", aliases: ["ทำอาหาร", "เชฟ", "ร้านอาหาร"] },
  { slug: "friendship", name: "มิตรภาพ", keywordQuery: "friendship", aliases: ["เพื่อน", "ความสัมพันธ์"] },
  { slug: "racing", name: "แข่งรถ", keywordQuery: "car race", aliases: ["รถแข่ง", "มอเตอร์สปอร์ต", "ความเร็ว"] },
  { slug: "dance", name: "เต้นรำ", keywordQuery: "dance", aliases: ["นักเต้น", "การเต้น"] },
  { slug: "nature", name: "ธรรมชาติและสัตว์ป่า", keywordQuery: "nature", aliases: ["สัตว์", "สิ่งแวดล้อม", "สารคดีธรรมชาติ"] },
  { slug: "ocean", name: "ทะเลและมหาสมุทร", keywordQuery: "ocean", aliases: ["ใต้น้ำ", "ท้องทะเล"] },
  { slug: "medical", name: "แพทย์และโรงพยาบาล", keywordQuery: "medical", aliases: ["หมอ", "พยาบาล", "การแพทย์"] },
  { slug: "school", name: "โรงเรียนและวัยเรียน", keywordQuery: "school", aliases: ["นักเรียน", "มัธยม", "มหาวิทยาลัย"] },
  { slug: "family-relationship", name: "ความสัมพันธ์ในครอบครัว", keywordQuery: "family relationships", aliases: ["พ่อแม่", "ลูก", "ครอบครัว"] },
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
