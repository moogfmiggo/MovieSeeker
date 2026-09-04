// Shared static genre data. Extracted from app/preferences/page.tsx (Phase 4)
// so the recommendation engine can resolve genre names without duplicating
// this list a second time.

import type { TMDBGenre } from "@/types/tmdb";

// TMDB's official Thai movie genre list (id/name pairs are TMDB's own,
// stable for years). Used only if a live call can't complete - so callers
// still work without inventing a second, independent genre system.
export const FALLBACK_GENRES: TMDBGenre[] = [
  { id: 28, name: "แอ็คชั่น" },
  { id: 12, name: "ผจญภัย" },
  { id: 16, name: "แอนิเมชัน" },
  { id: 35, name: "ตลก" },
  { id: 80, name: "อาชญากรรม" },
  { id: 99, name: "สารคดี" },
  { id: 18, name: "ดราม่า" },
  { id: 10751, name: "ครอบครัว" },
  { id: 14, name: "แฟนตาซี" },
  { id: 36, name: "ประวัติศาสตร์" },
  { id: 27, name: "สยองขวัญ" },
  { id: 10402, name: "เพลง" },
  { id: 9648, name: "ลึกลับ" },
  { id: 10749, name: "โรแมนซ์" },
  { id: 878, name: "นิยายวิทยาศาสตร์" },
  { id: 10770, name: "ภาพยนตร์ทางโทรทัศน์" },
  { id: 53, name: "ระทึกขวัญ" },
  { id: 10752, name: "สงคราม" },
  { id: 37, name: "ตะวันตก" },
];

/** TMDB's TV genre taxonomy is intentionally separate from movie genres. */
export const FALLBACK_TV_GENRES: TMDBGenre[] = [
  { id: 10759, name: "แอ็คชั่นและผจญภัย" },
  { id: 16, name: "แอนิเมชัน" },
  { id: 35, name: "ตลก" },
  { id: 80, name: "อาชญากรรม" },
  { id: 99, name: "สารคดี" },
  { id: 18, name: "ดราม่า" },
  { id: 10751, name: "ครอบครัว" },
  { id: 10762, name: "เด็ก" },
  { id: 9648, name: "ลึกลับ" },
  { id: 10763, name: "ข่าว" },
  { id: 10764, name: "เรียลลิตี้" },
  { id: 10765, name: "ไซไฟและแฟนตาซี" },
  { id: 10766, name: "ละครโทรทัศน์" },
  { id: 10767, name: "ทอล์กโชว์" },
  { id: 10768, name: "สงครามและการเมือง" },
  { id: 37, name: "ตะวันตก" },
];
