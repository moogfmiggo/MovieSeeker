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
 * layer (Supabase, Postgres, etc) plugs in by implementing this interface;
 * nothing else in the semantic system needs to change.
 *
 * Async: any real (network-backed) provider requires it, so the in-memory
 * reference implementation is async too - every implementation stays
 * genuinely interchangeable.
 */
export interface SemanticFactStore {
  get(movieId: number, attribute: string): Promise<SemanticFact | undefined>;
  set(fact: SemanticFact): Promise<void>;
  getAllForMovie(movieId: number): Promise<SemanticFact[]>;
}

/**
 * Contract a future semantic analyzer (LLM-backed or otherwise) must
 * satisfy to plug into this architecture. No implementation lives in this
 * project yet — this Task only defines the boundary.
 */
export interface SemanticAnalyzer {
  analyze(movieId: number, attribute: string): Promise<KnownSemanticFact>;
}

// --- Task 9: analysis queue (infrastructure only - nothing here executes
// analysis, calls an LLM, or processes items automatically) ---

export type AnalysisQueueStatus = "pending" | "processing" | "completed" | "failed";
export type AnalysisQueuePriority = "low" | "normal" | "high";

export interface AnalysisQueueItem {
  id: number;
  movieId: number;
  attribute: string;
  status: AnalysisQueueStatus;
  priority: AnalysisQueuePriority;
  createdAt: string;
  updatedAt: string;
}

/**
 * Storage contract for the analysis queue - mirrors SemanticFactStore's
 * provider-independence. findActive() only considers "pending"/"processing"
 * items (queue dedup is defined in terms of active items, not all history).
 */
export interface AnalysisQueueStore {
  findActive(movieId: number, attribute: string): Promise<AnalysisQueueItem | undefined>;
  enqueue(
    movieId: number,
    attribute: string,
    priority?: AnalysisQueuePriority,
  ): Promise<AnalysisQueueItem>;
  updateStatus(id: number, status: AnalysisQueueStatus): Promise<AnalysisQueueItem>;
  getById(id: number): Promise<AnalysisQueueItem | undefined>;
}

/** Result of checking coverage for several requested attributes at once. */
export interface CoverageResult {
  known: string[];
  missing: string[];
}
