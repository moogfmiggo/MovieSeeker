import type { SemanticAnalyzer, SemanticFact, SemanticFactStore } from "./types";

/**
 * Reusable attributes likely to be useful across many users/queries
 * ("core metadata"). Not exhaustive or permanent - adding a new core
 * attribute is just adding a string here; it never requires a schema
 * change, since SemanticFact.attribute is a plain string either way.
 * Anything not in this list is treated as query-specific by default.
 */
export const CORE_SEMANTIC_ATTRIBUTES = [
  "protagonist_death",
  "tragic_ending",
  "happy_ending",
  "time_travel",
  "revenge",
  "survival",
  "mystery",
  "heist",
  "plot_twist",
  "animal_death",
] as const;

export function isCoreAttribute(attribute: string): boolean {
  return (CORE_SEMANTIC_ATTRIBUTES as readonly string[]).includes(attribute);
}

/**
 * In-memory reference implementation of SemanticFactStore. Suitable for
 * this Task's architecture and tests only - not persistent across server
 * restarts. A future Task can swap in a Supabase/Postgres-backed store
 * implementing the same interface without changing any calling code.
 */
export class InMemorySemanticFactStore implements SemanticFactStore {
  private facts = new Map<string, SemanticFact>();

  private key(movieId: number, attribute: string): string {
    return `${movieId}:${attribute}`;
  }

  get(movieId: number, attribute: string): SemanticFact | undefined {
    return this.facts.get(this.key(movieId, attribute));
  }

  set(fact: SemanticFact): void {
    this.facts.set(this.key(fact.movieId, fact.attribute), fact);
  }

  getAllForMovie(movieId: number): SemanticFact[] {
    return [...this.facts.values()].filter((fact) => fact.movieId === movieId);
  }
}

export type SemanticCoverage = "known" | "missing";

/** Is there already a known (non-"unanalyzed") fact for this (movie, attribute)? */
export function checkSemanticCoverage(
  store: SemanticFactStore,
  movieId: number,
  attribute: string,
): SemanticCoverage {
  const fact = store.get(movieId, attribute);
  return fact && fact.status !== "unanalyzed" ? "known" : "missing";
}

/**
 * Conceptual future flow, made concrete and testable without calling any
 * real LLM: check existing data first; only fall through to `analyzer` -
 * an injected SemanticAnalyzer - when nothing is known yet. This project
 * never constructs a real analyzer; only test fakes do.
 */
export async function getSemanticFact(
  store: SemanticFactStore,
  analyzer: SemanticAnalyzer,
  movieId: number,
  attribute: string,
): Promise<SemanticFact> {
  const existing = store.get(movieId, attribute);
  if (existing && existing.status !== "unanalyzed") {
    return existing;
  }
  const analyzed = await analyzer.analyze(movieId, attribute);
  store.set(analyzed);
  return analyzed;
}

/**
 * Defensively validates an untrusted/raw value as a SemanticFact (e.g. data
 * coming back from a future storage layer). Returns null rather than
 * throwing on anything malformed.
 */
export function parseSemanticFact(raw: unknown): SemanticFact | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.movieId !== "number" || !Number.isFinite(obj.movieId)) return null;
  if (typeof obj.attribute !== "string" || obj.attribute.length === 0) return null;

  if (obj.status === "unanalyzed") {
    return { movieId: obj.movieId, attribute: obj.attribute, status: "unanalyzed" };
  }

  if (obj.status === "inferred" || obj.status === "verified") {
    const { value, confidence, source } = obj;
    const validValue =
      typeof value === "boolean" || typeof value === "string" || typeof value === "number";
    const validConfidence =
      typeof confidence === "number" &&
      Number.isFinite(confidence) &&
      confidence >= 0 &&
      confidence <= 1;
    const validSource = typeof source === "string" && source.length > 0;

    if (!validValue || !validConfidence || !validSource) return null;

    return {
      movieId: obj.movieId,
      attribute: obj.attribute,
      status: obj.status,
      value: value as boolean | string | number,
      confidence,
      source,
    };
  }

  return null;
}
