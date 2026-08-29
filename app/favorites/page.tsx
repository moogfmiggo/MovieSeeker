import { FavoritesList } from "@/components/FavoritesList";
import { th } from "@/lib/i18n";

export default function FavoritesPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{th.favoritesPage.title}</h1>
      <p className="mt-1 text-sm opacity-70">{th.favoritesPage.subtitle}</p>
      <FavoritesList />
    </main>
  );
}
