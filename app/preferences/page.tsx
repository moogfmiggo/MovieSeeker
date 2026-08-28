import { getMovieGenres, TMDBError } from "@/lib/tmdb";
import { PreferencesForm } from "@/components/PreferencesForm";
import type { TMDBGenre } from "@/types/tmdb";
import { th } from "@/lib/i18n";

// TMDB's official Thai movie genre list (id/name pairs are TMDB's own,
// stable for years). Used only if the live call can't complete - so this
// page still works without inventing a second, independent genre system.
const FALLBACK_GENRES: TMDBGenre[] = [
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

export default async function PreferencesPage() {
  let genres: TMDBGenre[];

  try {
    const data = await getMovieGenres();
    genres = data.genres;
  } catch (error) {
    console.error(
      "[preferences] live TMDB genre fetch unavailable, using fallback list:",
      error instanceof TMDBError ? error.message : "unknown error",
    );
    genres = FALLBACK_GENRES;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.preferencesPage.title}</h1>
      <p className="mt-1 text-sm opacity-70">{th.preferencesPage.subtitle}</p>
      <div className="mt-6">
        <PreferencesForm genres={genres} />
      </div>
    </main>
  );
}
