import { createClient } from "@supabase/supabase-js";
import type {
  AnalysisQueueItem,
  AnalysisQueuePriority,
  AnalysisQueueStatus,
  AnalysisQueueStore,
  KnownSemanticFact,
  SemanticFact,
  SemanticFactStore,
} from "./types";
import {
  InvalidQueueInputError,
  InvalidQueueTransitionError,
  QueueItemNotFoundError,
  isValidAttribute,
  isValidMovieId,
  isValidPriority,
  isValidQueueStatus,
  isValidQueueTransition,
  pickMostAuthoritative,
} from "./store";

const FACTS_TABLE = "semantic_facts";
const QUEUE_TABLE = "semantic_analysis_queue";

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export class SemanticStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SemanticStoreError";
  }
}

/**
 * Reads Supabase config from server-only env vars. Throws (before any
 * network call) if missing - never falls back to a hard-coded value, never
 * includes the key itself in any error message or log.
 */
function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new SupabaseConfigError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the server.",
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

// --- Semantic facts ---

interface SemanticFactRow {
  movie_id: number;
  attribute: string;
  value: boolean | string | number | null;
  confidence: number | null;
  source: string;
  status: string;
}

function rowToFact(row: SemanticFactRow): SemanticFact | null {
  if (row.status === "unanalyzed") {
    return { movieId: row.movie_id, attribute: row.attribute, status: "unanalyzed" };
  }
  if (
    (row.status === "inferred" || row.status === "verified") &&
    row.value !== null &&
    row.confidence !== null
  ) {
    return {
      movieId: row.movie_id,
      attribute: row.attribute,
      status: row.status,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
    };
  }
  return null; // malformed row (shouldn't happen given the schema's check constraint)
}

/**
 * Supabase/PostgreSQL implementation of the Task 7 SemanticFactStore
 * interface. See supabase/migrations/0001_create_semantic_facts.sql for
 * the schema. Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as
 * server-only env vars (see .env.example) - never read on the client.
 */
export class SupabaseSemanticFactStore implements SemanticFactStore {
  async get(movieId: number, attribute: string): Promise<SemanticFact | undefined> {
    const client = getClient();
    const { data, error } = await client
      .from(FACTS_TABLE)
      .select("movie_id, attribute, value, confidence, source, status")
      .eq("movie_id", movieId)
      .eq("attribute", attribute);

    if (error) throw new SemanticStoreError(`Failed to read semantic fact: ${error.message}`);
    if (!data || data.length === 0) return undefined;

    const facts = (data as SemanticFactRow[])
      .map(rowToFact)
      .filter((fact): fact is SemanticFact => fact !== null);
    if (facts.length === 0) return undefined;
    if (facts.length === 1) return facts[0];

    const known = facts.filter((f): f is KnownSemanticFact => f.status !== "unanalyzed");
    return known.length > 0 ? pickMostAuthoritative(known) : facts[0];
  }

  async set(fact: SemanticFact): Promise<void> {
    // "unanalyzed" has no source (nothing has analyzed it yet), so there is
    // nothing meaningful to persist - absence of a row already represents
    // "unanalyzed" via get().
    if (fact.status === "unanalyzed") return;

    const client = getClient();
    const { error } = await client.from(FACTS_TABLE).upsert(
      {
        movie_id: fact.movieId,
        attribute: fact.attribute,
        value: fact.value,
        confidence: fact.confidence,
        source: fact.source,
        status: fact.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "movie_id,attribute,source" },
    );

    if (error) throw new SemanticStoreError(`Failed to save semantic fact: ${error.message}`);
  }

  async getAllForMovie(movieId: number): Promise<SemanticFact[]> {
    const client = getClient();
    const { data, error } = await client
      .from(FACTS_TABLE)
      .select("movie_id, attribute, value, confidence, source, status")
      .eq("movie_id", movieId);

    if (error) throw new SemanticStoreError(`Failed to read semantic facts: ${error.message}`);
    return ((data ?? []) as SemanticFactRow[])
      .map(rowToFact)
      .filter((fact): fact is SemanticFact => fact !== null);
  }
}

// --- Task 9: analysis queue ---

interface AnalysisQueueRow {
  id: number;
  movie_id: number;
  attribute: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

function rowToQueueItem(row: AnalysisQueueRow): AnalysisQueueItem {
  return {
    id: row.id,
    movieId: row.movie_id,
    attribute: row.attribute,
    status: row.status as AnalysisQueueStatus,
    priority: row.priority as AnalysisQueuePriority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Supabase/PostgreSQL implementation of the Task 9 AnalysisQueueStore
 * interface. See supabase/migrations/0002_create_semantic_analysis_queue.sql.
 * Duplicate-active-request prevention is enforced at the database level via
 * a partial unique index (movie_id, attribute) where status in
 * ('pending','processing') - enqueue() also pre-checks via findActive() to
 * avoid needing to reach the database for the common case, and gracefully
 * recovers if a concurrent request wins the race.
 */
export class SupabaseAnalysisQueueStore implements AnalysisQueueStore {
  async findActive(movieId: number, attribute: string): Promise<AnalysisQueueItem | undefined> {
    const client = getClient();
    const { data, error } = await client
      .from(QUEUE_TABLE)
      .select("id, movie_id, attribute, status, priority, created_at, updated_at")
      .eq("movie_id", movieId)
      .eq("attribute", attribute)
      .in("status", ["pending", "processing"])
      .limit(1)
      .maybeSingle();

    if (error) throw new SemanticStoreError(`Failed to check analysis queue: ${error.message}`);
    return data ? rowToQueueItem(data as AnalysisQueueRow) : undefined;
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

    const client = getClient();
    const { data, error } = await client
      .from(QUEUE_TABLE)
      .insert({ movie_id: movieId, attribute, status: "pending", priority })
      .select("id, movie_id, attribute, status, priority, created_at, updated_at")
      .single();

    if (error) {
      // Unique violation: a concurrent request won the race between our
      // findActive() check and this insert. Treat as "already queued"
      // rather than surfacing an error.
      if (error.code === "23505") {
        const raceWinner = await this.findActive(movieId, attribute);
        if (raceWinner) return raceWinner;
      }
      throw new SemanticStoreError(`Failed to enqueue analysis request: ${error.message}`);
    }
    return rowToQueueItem(data as AnalysisQueueRow);
  }

  async updateStatus(id: number, status: AnalysisQueueStatus): Promise<AnalysisQueueItem> {
    if (!isValidQueueStatus(status)) {
      throw new InvalidQueueInputError(`Invalid status: ${JSON.stringify(status)}`);
    }

    const current = await this.getById(id);
    if (!current) throw new QueueItemNotFoundError(`Queue item ${id} not found`);

    if (!isValidQueueTransition(current.status, status)) {
      throw new InvalidQueueTransitionError(
        `Cannot transition queue item ${id} from '${current.status}' to '${status}'`,
      );
    }

    const client = getClient();
    const { data, error } = await client
      .from(QUEUE_TABLE)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, movie_id, attribute, status, priority, created_at, updated_at")
      .single();

    if (error) throw new SemanticStoreError(`Failed to update queue item: ${error.message}`);
    return rowToQueueItem(data as AnalysisQueueRow);
  }

  async getById(id: number): Promise<AnalysisQueueItem | undefined> {
    const client = getClient();
    const { data, error } = await client
      .from(QUEUE_TABLE)
      .select("id, movie_id, attribute, status, priority, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error) throw new SemanticStoreError(`Failed to read queue item: ${error.message}`);
    return data ? rowToQueueItem(data as AnalysisQueueRow) : undefined;
  }
}
