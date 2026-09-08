import { NextResponse } from "next/server";
import {
  evaluateSemanticAttribute,
  evaluateSemanticConstraints,
  getRequestedSemanticAttributes,
  getSemanticStorageAttribute,
  normalizeSemanticConstraints,
  type SemanticAnalysisFact,
  type SemanticCandidateAnalysis,
  type SemanticCandidateInput,
  type SemanticMediaType,
} from "@/lib/semantic/constraints";
import { normalizeStoryRequirement } from "@/lib/naturalSearch";
import { SupabaseSemanticFactStore } from "@/lib/semantic/supabase-store";
import type { KnownSemanticFact } from "@/lib/semantic/types";
import { withTimeoutFallback } from "@/lib/timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const MAX_CANDIDATES = 20;
const AI_HEALTH_TIMEOUT_MS = 800;
const AI_ANALYSIS_TIMEOUT_MS = 35_000;
const MINIMUM_CONFIDENCE = 0.55;
const CACHE_TIMEOUT_MS = 1_200;

interface SemanticFilterRequest {
  mediaType?: unknown;
  constraints?: unknown;
  storyRequirement?: unknown;
  candidates?: unknown;
}

function getStoryAttribute(requirement: string): string {
  let firstHash = 2_166_136_261;
  let secondHash = 2_166_136_261 ^ 0x9e3779b9;
  const identity = requirement.normalize("NFKC").toLocaleLowerCase("th-TH");
  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    firstHash ^= code;
    firstHash = Math.imul(firstHash, 16_777_619);
    secondHash ^= code + index;
    secondHash = Math.imul(secondHash, 16_777_619);
  }
  return `story_match_${(firstHash >>> 0).toString(16).padStart(8, "0")}${(secondHash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeText(raw: unknown, maxLength: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, maxLength) : "";
}

function parseCandidate(raw: unknown, mediaType: SemanticMediaType): SemanticCandidateInput | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const id = candidate.id;
  const title = normalizeText(candidate.title, 200);
  if (!Number.isSafeInteger(id) || Number(id) <= 0 || !title) return null;

  return {
    id: Number(id),
    mediaType,
    title,
    originalTitle: normalizeText(candidate.originalTitle, 200) || title,
    overview: normalizeText(candidate.overview, 2_000),
    releaseYear: /^\d{4}$/.test(normalizeText(candidate.releaseYear, 4))
      ? normalizeText(candidate.releaseYear, 4)
      : "",
  };
}

function parseCandidates(raw: unknown, mediaType: SemanticMediaType): SemanticCandidateInput[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  return raw
    .slice(0, MAX_CANDIDATES)
    .map((candidate) => parseCandidate(candidate, mediaType))
    .filter((candidate): candidate is SemanticCandidateInput => {
      if (candidate === null || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
}

function factsByCandidate(
  facts: readonly KnownSemanticFact[],
  candidates: readonly SemanticCandidateInput[],
  mediaType: SemanticMediaType,
  attributes: readonly string[],
): Map<number, SemanticAnalysisFact[]> {
  const expectedAttributeByKey = new Map<string, string>();
  for (const candidate of candidates) {
    for (const attribute of attributes) {
      expectedAttributeByKey.set(
        `${candidate.id}:${getSemanticStorageAttribute(mediaType, attribute, candidate)}`,
        attribute,
      );
    }
  }

  const byCandidate = new Map<number, SemanticAnalysisFact[]>();
  for (const fact of facts) {
    const attribute = expectedAttributeByKey.get(`${fact.movieId}:${fact.attribute}`);
    if (!attribute || typeof fact.value !== "boolean") continue;
    const current = byCandidate.get(fact.movieId) ?? [];
    current.push({
      attribute,
      value: fact.value,
      confidence: fact.confidence,
      source: fact.source,
    });
    byCandidate.set(fact.movieId, current);
  }
  return byCandidate;
}

function hasUsableFact(facts: readonly SemanticAnalysisFact[], attribute: string): boolean {
  return facts.some(
    (fact) =>
      fact.attribute === attribute &&
      typeof fact.value === "boolean" &&
      fact.confidence >= MINIMUM_CONFIDENCE,
  );
}

function parseAiAnalyses(
  raw: unknown,
  candidates: readonly SemanticCandidateInput[],
  attributes: readonly string[],
): SemanticCandidateAnalysis[] | null {
  if (!raw || typeof raw !== "object") return null;
  const analyses = (raw as { analyses?: unknown }).analyses;
  if (!Array.isArray(analyses)) return null;

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const validAttributes = new Set(attributes);
  const byId = new Map<number, SemanticCandidateAnalysis>();

  for (const rawAnalysis of analyses) {
    if (!rawAnalysis || typeof rawAnalysis !== "object") continue;
    const analysis = rawAnalysis as Record<string, unknown>;
    if (!Number.isSafeInteger(analysis.id) || !candidateIds.has(Number(analysis.id))) continue;
    if (!Array.isArray(analysis.facts)) continue;

    const facts: SemanticAnalysisFact[] = [];
    const seenAttributes = new Set<string>();
    for (const rawFact of analysis.facts) {
      if (!rawFact || typeof rawFact !== "object") continue;
      const fact = rawFact as Record<string, unknown>;
      const attribute = typeof fact.attribute === "string" ? fact.attribute : "";
      if (!validAttributes.has(attribute) || seenAttributes.has(attribute)) continue;
      const value = fact.value === true || fact.value === false ? fact.value : null;
      const rawConfidence = typeof fact.confidence === "number" ? fact.confidence : 0;
      const normalizedConfidence = Number.isFinite(rawConfidence)
        ? Math.min(Math.max(rawConfidence, 0), 1)
        : 0;
      const rawSource = normalizeText(fact.source, 500);
      const source = rawSource.startsWith("wikipedia:https://en.wikipedia.org/wiki/")
        ? rawSource
        : "model:local";
      const confidence = value === null
        ? 0
        : Math.min(normalizedConfidence, source.startsWith("wikipedia:") ? 0.95 : 0.65);
      facts.push({ attribute, value, confidence, source });
      seenAttributes.add(attribute);
    }
    byId.set(Number(analysis.id), { id: Number(analysis.id), facts });
  }

  return candidates.map((candidate) => byId.get(candidate.id) ?? { id: candidate.id, facts: [] });
}

async function readCachedFacts(
  candidates: readonly SemanticCandidateInput[],
  mediaType: SemanticMediaType,
  attributes: readonly string[],
): Promise<KnownSemanticFact[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const operation = new SupabaseSemanticFactStore()
    .getMany(
      candidates.map((candidate) => candidate.id),
      candidates.flatMap((candidate) =>
        attributes.map((attribute) => getSemanticStorageAttribute(mediaType, attribute, candidate)),
      ),
    )
    .catch((error: unknown) => {
      console.error(
        "[semantic search] cache read unavailable:",
        error instanceof Error ? error.message : "unknown error",
      );
      return [];
    });
  return withTimeoutFallback(operation, CACHE_TIMEOUT_MS, []);
}

async function saveFacts(
  analyses: readonly SemanticCandidateAnalysis[],
  candidates: readonly SemanticCandidateInput[],
  mediaType: SemanticMediaType,
): Promise<void> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const facts: KnownSemanticFact[] = analyses.flatMap((analysis) =>
    analysis.facts
      .filter(
        (fact): fact is SemanticAnalysisFact & { value: boolean } =>
          typeof fact.value === "boolean" && fact.confidence >= MINIMUM_CONFIDENCE,
      )
      .flatMap((fact) => {
        const candidate = candidateById.get(analysis.id);
        return candidate
          ? [{
              movieId: analysis.id,
              attribute: getSemanticStorageAttribute(mediaType, fact.attribute, candidate),
              status: "inferred" as const,
              value: fact.value,
              confidence: fact.confidence,
              source: fact.source,
            }]
          : [];
      }),
  );
  if (facts.length === 0) return;

  const operation = new SupabaseSemanticFactStore().setMany(facts).catch((error: unknown) => {
    // Search remains usable even while persistent caching is unavailable.
    console.error(
      "[semantic search] cache write unavailable:",
      error instanceof Error ? error.message : "unknown error",
    );
  });
  await withTimeoutFallback(operation, CACHE_TIMEOUT_MS, undefined);
}

async function requestAiAnalysis(
  candidates: readonly SemanticCandidateInput[],
  attributes: readonly string[],
  storyRequirement: string,
  storyAttribute: string,
): Promise<{ analyses: SemanticCandidateAnalysis[]; source: "ai" | "cache" } | null> {
  const serverUrl = process.env.MOVIESEEKER_AI_SERVER_URL?.trim();
  const token = process.env.MOVIESEEKER_AI_SERVER_TOKEN?.trim();
  if (!serverUrl || !token) return null;

  try {
    const health = await fetch(new URL("/health", serverUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(AI_HEALTH_TIMEOUT_MS),
    });
    if (!health.ok) return null;

    const response = await fetch(new URL("/v1/semantic-filter", serverUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ candidates, attributes, storyRequirement, storyAttribute }),
      cache: "no-store",
      signal: AbortSignal.timeout(AI_ANALYSIS_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const raw: unknown = await response.json();
    const analyses = parseAiAnalyses(raw, candidates, attributes);
    if (!analyses) return null;
    const source =
      raw && typeof raw === "object" && (raw as { source?: unknown }).source === "cache"
        ? "cache"
        : "ai";
    return { analyses, source };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: SemanticFilterRequest;
  try {
    body = (await request.json()) as SemanticFilterRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mediaType: SemanticMediaType = body.mediaType === "tv" ? "tv" : "movie";
  const constraints = normalizeSemanticConstraints(body.constraints);
  const storyRequirement = normalizeStoryRequirement(body.storyRequirement);
  const storyAttribute = storyRequirement ? getStoryAttribute(storyRequirement) : "";
  const candidates = parseCandidates(body.candidates, mediaType);
  if ((constraints.length === 0 && !storyRequirement) || candidates.length === 0) {
    return NextResponse.json(
      { error: "At least one valid story condition and candidate is required." },
      { status: 400 },
    );
  }

  const attributes = [
    ...getRequestedSemanticAttributes(constraints),
    ...(storyAttribute ? [storyAttribute] : []),
  ];
  const cachedFacts = await readCachedFacts(candidates, mediaType, attributes);
  const cachedByCandidate = factsByCandidate(cachedFacts, candidates, mediaType, attributes);
  const missingCandidates = candidates.filter((candidate) => {
    const facts = cachedByCandidate.get(candidate.id) ?? [];
    return attributes.some((attribute) => !hasUsableFact(facts, attribute));
  });

  let freshAnalyses: SemanticCandidateAnalysis[] = [];
  let analysisSource: "ai" | "cache" = "cache";
  if (missingCandidates.length > 0) {
    const response = await requestAiAnalysis(
      missingCandidates,
      attributes,
      storyRequirement,
      storyAttribute,
    );
    if (!response) {
      return NextResponse.json(
        { applied: false, reason: "ai_unavailable" },
        { headers: { "cache-control": "no-store" } },
      );
    }
    freshAnalyses = response.analyses;
    analysisSource = response.source;
    await saveFacts(freshAnalyses, missingCandidates, mediaType);
  }

  const freshByCandidate = new Map(freshAnalyses.map((analysis) => [analysis.id, analysis.facts]));
  const matchedIds: number[] = [];
  const rejectedIds: number[] = [];
  const unknownIds: number[] = [];

  for (const candidate of candidates) {
    const facts = [
      ...(cachedByCandidate.get(candidate.id) ?? []),
      ...(freshByCandidate.get(candidate.id) ?? []),
    ];
    const fixedDecision = evaluateSemanticConstraints(
      constraints,
      facts,
      MINIMUM_CONFIDENCE,
    );
    const storyDecision = storyAttribute
      ? evaluateSemanticAttribute(storyAttribute, facts, true, MINIMUM_CONFIDENCE)
      : "match";
    const decision = fixedDecision === "reject" || storyDecision === "reject"
      ? "reject"
      : fixedDecision === "unknown" || storyDecision === "unknown"
        ? "unknown"
        : "match";
    (decision === "match" ? matchedIds : decision === "reject" ? rejectedIds : unknownIds).push(
      candidate.id,
    );
  }

  return NextResponse.json(
    {
      applied: true,
      source: missingCandidates.length > 0 ? analysisSource : "cache",
      matchedIds,
      rejectedIds,
      unknownIds,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
