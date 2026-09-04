"use client";

import { th } from "@/lib/i18n";

export default function SearchError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-bold">{th.moviesError.title}</h1>
      <p className="mt-2 text-sm opacity-70">{th.moviesError.body}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground"
      >
        {th.common.tryAgain}
      </button>
    </main>
  );
}
