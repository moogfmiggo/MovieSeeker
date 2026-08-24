import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Movie Recommendation
      </h1>
      <p className="max-w-md text-lg opacity-70">
        Find movies that match your taste.
      </p>
      <Link
        href="/movies"
        className="mt-4 rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        Find Movies
      </Link>
    </main>
  );
}
