import { WatchedList } from "@/components/WatchedList";

export default function WatchedPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Watched Movies</h1>
      <p className="mt-1 text-sm opacity-70">Movies you&apos;ve marked as watched.</p>
      <WatchedList />
    </main>
  );
}
