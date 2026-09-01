"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TMDBGenre } from "@/types/tmdb";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import { buildMoviesHref } from "@/lib/movieSearch";
import { th } from "@/lib/i18n";

export function PreferencesForm({ genres }: { genres: TMDBGenre[] }) {
  const [selectedGenreIds, setSelectedGenreIds] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "saved" | "error">("idle");
  // Whether there's a saved state worth continuing to /movies with - true
  // once a save succeeds, or immediately if restored preferences already
  // exist. Deliberately separate from `feedback`, which auto-hides after a
  // few seconds; this should stay visible once it's true.
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);
  const [savedGenreIds, setSavedGenreIds] = useState<number[]>([]);

  // localStorage only exists in the browser, so preferences are restored
  // after mount rather than during the initial (server-rendered) render.
  // This is the standard hydration-safe pattern for a one-time external
  // read on mount (same shape as e.g. next-themes' mounted-check) and is a
  // documented false positive for this rule on exactly this pattern.
  useEffect(() => {
    const restored = loadPreferences();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGenreIds(restored);
    setSavedGenreIds(restored);
    setHasSavedPreferences(restored.length > 0);
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
    if (success) {
      setSavedGenreIds(selectedGenreIds);
      setHasSavedPreferences(true);
    }
  }

  return (
    <div>
      <p className="text-sm opacity-70">
        {selectedGenreIds.length === 0
          ? th.preferencesPage.noneSelected
          : th.preferencesPage.selectedCount(selectedGenreIds.length)}
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
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-transparent hover:border-border-strong"
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
          className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          {th.preferencesPage.save}
        </button>
        {feedback === "saved" && (
          <span role="status" className="text-sm text-green-400">
            {th.preferencesPage.saved}
          </span>
        )}
        {feedback === "error" && (
          <span role="status" className="text-sm text-red-400">
            {th.preferencesPage.saveError}
          </span>
        )}
      </div>

      {hasSavedPreferences && (
        <p className="mt-4">
          <Link
            href={buildMoviesHref(savedGenreIds)}
            className="text-sm font-medium text-accent underline underline-offset-2 hover:no-underline"
          >
            {th.preferencesPage.goToMovies}
          </Link>
        </p>
      )}
    </div>
  );
}
