import { createClient } from "@supabase/supabase-js";
import type { KnownSemanticFact, SemanticFact, SemanticFactStore } from "./types";

const TABLE = "semantic_facts";

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
  // Malformed row (shouldn't happen given the schema's check constraint) -
  // skip defensively rather than crash the caller.
  return null;
}

const STATUS_PRIORITY: Record<string, number> = { verified: 2, inferred: 1 };

/**
 * The unique key is (movie, attribute, source), so multiple sources can
 * legitimately have recorded a fact for the same (movie, attribute).
 * get() returns one answer, so when more than one exists: prefer
 * "verified" over "inferred", then higher confidence.
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
      .from(TABLE)
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
    const { error } = await client.from(TABLE).upsert(
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
      .from(TABLE)
      .select("movie_id, attribute, value, confidence, source, status")
      .eq("movie_id", movieId);

    if (error) throw new SemanticStoreError(`Failed to read semantic facts: ${error.message}`);
    return ((data ?? []) as SemanticFactRow[])
      .map(rowToFact)
      .filter((fact): fact is SemanticFact => fact !== null);
  }
}
