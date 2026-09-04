"use client";

import { useEffect } from "react";
import { th } from "@/lib/i18n";

export default function SeriesDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold">{th.seriesDetailError.title}</h1>
      <p className="max-w-sm text-sm opacity-70">{th.seriesDetailError.body}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
      >
        {th.common.tryAgain}
      </button>
    </main>
  );
}
