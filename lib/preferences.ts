// Client-side only storage for the user's selected movie genre preferences.
// Deliberately isolated from the TMDB integration and from any future
// recommendation logic — this module only ever deals with a flat array of
// genre IDs, which is what future Tasks (recommendations) will consume.

const PREFERENCES_STORAGE_KEY = "movie-recommendation:preferences";

interface StoredPreferences {
  genreIds: number[];
}

/** Reads saved genre preferences. Returns [] if none exist, or if the stored data is invalid/corrupted. */
export function loadPreferences(): number[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Partial<StoredPreferences>).genreIds)
    ) {
      return [];
    }

    return (parsed as StoredPreferences).genreIds.filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id),
    );
  } catch {
    // Corrupted JSON or a localStorage access error - treat as "no preferences".
    return [];
  }
}

/** Saves the selected genre IDs. Returns true on success. */
export function savePreferences(genreIds: number[]): boolean {
  if (typeof window === "undefined") return false;

  try {
    const data: StoredPreferences = { genreIds };
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
