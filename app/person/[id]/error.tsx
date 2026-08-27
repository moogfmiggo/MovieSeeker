"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function PersonError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold">We couldn&apos;t load this person</h1>
      <p className="max-w-sm text-sm opacity-70">
        Something went wrong while fetching this profile from TMDB. Please try again.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        Try again
      </button>
    </main>
  );
}
