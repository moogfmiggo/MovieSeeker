"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { th } from "@/lib/i18n";

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
      <h1 className="text-xl font-semibold">{th.personError.title}</h1>
      <p className="max-w-sm text-sm opacity-70">{th.personError.body}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
      >
        {th.common.tryAgain}
      </button>
    </main>
  );
}
