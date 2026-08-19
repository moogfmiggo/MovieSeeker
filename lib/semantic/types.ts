/**
 * Provider-independent data model for semantic movie facts (e.g. "does the
 * dog die in this movie?"). This Task only prepares the architecture - no
 * LLM is called and no specific provider (OpenAI/Claude/Gemini/etc) is
 * referenced anywhere in this module.
 */

/**
 * A fact's lifecycle stage. Extensible: add new values as new sources of
 * truth appear, without touching anything that only cares about
 * known-vs-unanalyzed.
 */
export type SemanticFactStatus = "unanalyzed" | "inferred" | "verified";

/** Core metadata tends to be boolean (dog_death, happy_ending, ...); query-specific
 * metadata can be descriptive (protagonist_race, animal breed, ...). */
export type SemanticFactValue = boolean | string | number;

/**
 * No fact has been recorded yet for this (movie, attribute) pair. A
 * genuinely distinct state from "known false" - there is no `value` field
 * here at all, so it structurally cannot be misread as one.
 */
export interface UnanalyzedSemanticFact {
  movieId: number;
  attribute: string;
  status: "unanalyzed";
}

/** A fact with a known value, at some confidence, from some source. */
export interface KnownSemanticFact {
  movieId: number;
  attribute: string;
  status: "inferred" | "verified";
  value: SemanticFactValue;
  /** 0-1. How confident the source is in `value`. */
  confidence: number;
  /** Free-form provenance, e.g. "manual", "llm:<provider>". Never a specific provider name in this codebase. */
  source: string;
}

export type SemanticFact = UnanalyzedSemanticFact | KnownSemanticFact;

/**
 * Storage contract for semantic facts. This is shared, cross-user data -
 * deliberately NOT localStorage (which is per-browser and reserved for
 * user-specific state like preferences/watched movies). A real persistence
 * layer (Supabase, Postgres, etc) plugs in later by implementing this
 * interface; nothing else in the semantic system needs to change.
 */
export interface SemanticFactStore {
  get(movieId: number, attribute: string): SemanticFact | undefined;
  set(fact: SemanticFact): void;
  getAllForMovie(movieId: number): SemanticFact[];
}

/**
 * Contract a future semantic analyzer (LLM-backed or otherwise) must
 * satisfy to plug into this architecture. No implementation lives in this
 * project yet — this Task only defines the boundary.
 */
export interface SemanticAnalyzer {
  analyze(movieId: number, attribute: string): Promise<KnownSemanticFact>;
}
