"use client";

import { useEffect, useState } from "react";
import type { TMDBGenre } from "@/types/tmdb";
import { loadPreferences, savePreferences } from "@/lib/preferences";

export function PreferencesForm({ genres }: { genres: TMDBGenre[] }) {
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "saved" | "error">("idle");

  // localStorage only exists in the browser, so preferences are restored
  // after mount rather than during the initial (server-rendered) render.
  // This is the standard hydration-safe pattern for a one-time external
  // read on mount (same shape as e.g. next-themes' mounted-check) and is a
  // documented false positive for this rule on exactly this pattern.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGenreIds(loadPreferences());
  }, []);

  useEffect(() => {
    if (feedback === "idle") return;
    const timer = setTimeout(() => setFeedback("idle"), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  function toggleGenre(id: number) {
    setSelectedGenreIds((current) =>
      current.includes(id) ? current.filter((genreId) => genreId !== id) : [...current, id],
    );
  }

  function handleSave() {
    const success = savePreferences(selectedGenreIds);
    setFeedback(success ? "saved" : "error");
  }

  return (
    <div>
      <p className="text-sm opacity-70">
        {selectedGenreIds.length === 0
          ? "No genres selected yet."
          : `${selectedGenreIds.length} genre${selectedGenreIds.length === 1 ? "" : "s"} selected.`}
      </p>

      <ul className="mt-4 flex list-none flex-wrap gap-2 p-0">
        {genres.map((genre) => {
          const isSelected = selectedGenreIds.includes(genre.id);
          return (
            <li key={genre.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleGenre(genre.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isSelected
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-black/15 bg-transparent hover:border-black/30"
                }`}
              >
                {genre.name}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Save preferences
        </button>
        {feedback === "saved" && (
          <span role="status" className="text-sm text-green-700">
            Preferences saved.
          </span>
        )}
        {feedback === "error" && (
          <span role="status" className="text-sm text-red-700">
            Couldn&apos;t save preferences. Please try again.
          </span>
        )}
      </div>
    </div>
  );
}
