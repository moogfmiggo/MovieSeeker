import type {
  AnalysisQueueItem,
  AnalysisQueuePriority,
  AnalysisQueueStatus,
  AnalysisQueueStore,
  CoverageResult,
  KnownSemanticFact,
  SemanticAnalyzer,
  SemanticFact,
  SemanticFactStore,
} from "./types";

// --- Core attributes registry (Task 7) ---

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

// --- Multi-source authority (Task 8/9) ---

const STATUS_PRIORITY: Record<string, number> = { verified: 2, inferred: 1 };

/**
 * The unique key for a stored fact is (movie, attribute, source), so
 * multiple sources can legitimately have recorded a fact for the same
 * (movie, attribute). Any read path that might see more than one must
 * pick a single answer: prefer "verified" over "inferred", then higher
 * confidence. Never lets a weaker fact silently shadow a stronger one.
 */
export function pickMostAuthoritative(facts: KnownSemanticFact[]): KnownSemanticFact {
  return facts.reduce((best, candidate) => {
    const bestPriority = STATUS_PRIORITY[best.status] ?? 0;
    const candidatePriority = STATUS_PRIORITY[candidate.status] ?? 0;
    if (candidatePriority !== bestPriority) {
      return candidatePriority > bestPriority ? candidate : best;
    }
    return candidate.confidence > best.confidence ? candidate : best;
  });
}

// --- In-memory reference fact store (Task 7/8) ---

/**
 * In-memory reference implementation of SemanticFactStore. Suitable for
 * tests and local development only - not persistent across process
 * restarts. lib/semantic/supabase-store.ts implements the same interface
 * against a real database without changing any calling code.
 *
 * Keyed by (movieId, attribute, source) to match the real schema's unique
 * constraint - multiple sources can coexist; get() applies the same
 * authority rule as the Supabase implementation.
 */
export class InMemorySemanticFactStore implements SemanticFactStore {
  private facts = new Map<string, SemanticFact>();

  private key(movieId: number, attribute: string, source: string): string {
    return `${movieId}:${attribute}:${source}`;
  }

  async get(movieId: number, attribute: string): Promise<SemanticFact | undefined> {
    const matches = [...this.facts.values()].filter(
      (fact) => fact.movieId === movieId && fact.attribute === attribute,
    );
    if (matches.length === 0) return undefined;

    const known = matches.filter((f): f is KnownSemanticFact => f.status !== "unanalyzed");
    if (known.length > 0) return pickMostAuthoritative(known);
    return matches[0]; // only "unanalyzed" entries present
  }

  async set(fact: SemanticFact): Promise<void> {
    // "unanalyzed" has no source; there is nothing to key it uniquely by,
    // so (like the Supabase store) it is not persisted as a row - absence
    // of any row already represents "unanalyzed" via get().
    if (fact.status === "unanalyzed") return;
    this.facts.set(this.key(fact.movieId, fact.attribute, fact.source), fact);
  }

  async getAllForMovie(movieId: number): Promise<SemanticFact[]> {
    return [...this.facts.values()].filter((fact) => fact.movieId === movieId);
  }
}

export type SemanticCoverage = "known" | "missing";

/** Is there already a known (non-"unanalyzed") fact for this (movie, attribute)? */
export async function checkSemanticCoverage(
  store: SemanticFactStore,
  movieId: number,
  attribute: string,
): Promise<SemanticCoverage> {
  const fact = await store.get(movieId, attribute);
  return fact && fact.status !== "unanalyzed" ? "known" : "missing";
}

/** Batch version: partitions requested attributes into known vs missing. */
export async function checkSemanticCoverageBatch(
  store: SemanticFactStore,
  movieId: number,
  attributes: readonly string[],
): Promise<CoverageResult> {
  const known: string[] = [];
  const missing: string[] = [];
  for (const attribute of attributes) {
    const coverage = await checkSemanticCoverage(store, movieId, attribute);
    (coverage === "known" ? known : missing).push(attribute);
  }
  return { known, missing };
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
  const existing = await store.get(movieId, attribute);
  if (existing && existing.status !== "unanalyzed") {
    return existing;
  }
  const analyzed = await analyzer.analyze(movieId, attribute);
  await store.set(analyzed);
  return analyzed;
}

/**
 * Defensively validates an untrusted/raw value as a SemanticFact (e.g. data
 * coming back from a storage layer). Returns null rather than throwing on
 * anything malformed.
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

// --- Task 9: analysis queue ---

export class InvalidQueueInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueueInputError";
  }
}

export class InvalidQueueTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidQueueTransitionError";
  }
}

export class QueueItemNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueItemNotFoundError";
  }
}

export function isValidMovieId(movieId: unknown): movieId is number {
  return typeof movieId === "number" && Number.isFinite(movieId) && movieId > 0;
}

export function isValidAttribute(attribute: unknown): attribute is string {
  return typeof attribute === "string" && attribute.trim().length > 0;
}

export function isValidPriority(priority: unknown): priority is AnalysisQueuePriority {
  return priority === "low" || priority === "normal" || priority === "high";
}

export function isValidQueueStatus(status: unknown): status is AnalysisQueueStatus {
  return (
    status === "pending" || status === "processing" || status === "completed" || status === "failed"
  );
}

/**
 * Allowed forward transitions. "completed" and "failed" are terminal for a
 * given queue item - no automatic retry/reopening here (out of scope for
 * this Task). A retry, if it happens later, creates a new queue item once
 * this one is no longer "active" (see isRetryable + the partial unique
 * index in the migration).
 */
export const VALID_QUEUE_TRANSITIONS: Record<AnalysisQueueStatus, AnalysisQueueStatus[]> = {
  pending: ["processing"],
  processing: ["completed", "failed"],
  completed: [],
  failed: [],
};

export function isValidQueueTransition(
  from: AnalysisQueueStatus,
  to: AnalysisQueueStatus,
): boolean {
  return VALID_QUEUE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A failed item is a candidate for a future (manually-triggered) retry - no automatic retry happens here. */
export function isRetryable(item: AnalysisQueueItem): boolean {
  return item.status === "failed";
}

/**
 * In-memory reference implementation of AnalysisQueueStore. Same role as
 * InMemorySemanticFactStore: tests and local dev only.
 */
export class InMemoryAnalysisQueueStore implements AnalysisQueueStore {
  private items = new Map<number, AnalysisQueueItem>();
  private nextId = 1;

  async findActive(movieId: number, attribute: string): Promise<AnalysisQueueItem | undefined> {
    for (const item of this.items.values()) {
      if (
        item.movieId === movieId &&
        item.attribute === attribute &&
        (item.status === "pending" || item.status === "processing")
      ) {
        return item;
      }
    }
    return undefined;
  }

  async enqueue(
    movieId: number,
    attribute: string,
    priority: AnalysisQueuePriority = "normal",
  ): Promise<AnalysisQueueItem> {
    if (!isValidMovieId(movieId)) {
      throw new InvalidQueueInputError(`Invalid movieId: ${JSON.stringify(movieId)}`);
    }
    if (!isValidAttribute(attribute)) {
      throw new InvalidQueueInputError(`Invalid attribute: ${JSON.stringify(attribute)}`);
    }
    if (!isValidPriority(priority)) {
      throw new InvalidQueueInputError(`Invalid priority: ${JSON.stringify(priority)}`);
    }

    const existing = await this.findActive(movieId, attribute);
    if (existing) return existing;

    const now = new Date().toISOString();
    const item: AnalysisQueueItem = {
      id: this.nextId++,
      movieId,
      attribute,
      status: "pending",
      priority,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(item.id, item);
    return item;
  }

  async updateStatus(id: number, status: AnalysisQueueStatus): Promise<AnalysisQueueItem> {
    if (!isValidQueueStatus(status)) {
      throw new InvalidQueueInputError(`Invalid status: ${JSON.stringify(status)}`);
    }
    const item = this.items.get(id);
    if (!item) throw new QueueItemNotFoundError(`Queue item ${id} not found`);

    if (!isValidQueueTransition(item.status, status)) {
      throw new InvalidQueueTransitionError(
        `Cannot transition queue item ${id} from '${item.status}' to '${status}'`,
      );
    }

    const updated: AnalysisQueueItem = { ...item, status, updatedAt: new Date().toISOString() };
    this.items.set(id, updated);
    return updated;
  }

  async getById(id: number): Promise<AnalysisQueueItem | undefined> {
    return this.items.get(id);
  }
}

export type SemanticAttributeRequestResult =
  | { kind: "known"; fact: KnownSemanticFact }
  | { kind: "queued"; queueItem: AnalysisQueueItem };

/**
 * The Task 9 flow end to end: if the attribute is already known, return
 * that (no queueing). If not, reuse an existing active queue item if one
 * exists, otherwise create exactly one. Never calls an analyzer, never
 * writes a semantic fact - this only decides "known" vs "needs queueing".
 */
export async function requestSemanticAttribute(
  factStore: SemanticFactStore,
  queueStore: AnalysisQueueStore,
  movieId: number,
  attribute: string,
  priority: AnalysisQueuePriority = "normal",
): Promise<SemanticAttributeRequestResult> {
  const fact = await factStore.get(movieId, attribute);
  if (fact && fact.status !== "unanalyzed") {
    return { kind: "known", fact };
  }

  const existingQueueItem = await queueStore.findActive(movieId, attribute);
  if (existingQueueItem) {
    return { kind: "queued", queueItem: existingQueueItem };
  }

  const queueItem = await queueStore.enqueue(movieId, attribute, priority);
  return { kind: "queued", queueItem };
}
