import { NextResponse } from "next/server";
import {
  buildNaturalSearchHref,
  getNaturalSearchTaxonomy,
  interpretNaturalSearchFallback,
  type SearchIntentSource,
  type SearchMediaType,
  validateAiSearchIntent,
} from "@/lib/naturalSearch";
import { normalizeStreamingProviderIds } from "@/lib/streamingProviders";

export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 300;
const DEFAULT_AI_TIMEOUT_MS = 8_000;

interface SearchIntentRequest {
  query?: unknown;
  preferredMediaType?: unknown;
  providerIds?: unknown;
}

function readTimeoutMs(): number {
  const parsed = Number(process.env.MOVIESEEKER_AI_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_AI_TIMEOUT_MS;
  return Math.min(Math.max(Math.trunc(parsed), 1_000), 15_000);
}

async function requestAiIntent(
  query: string,
  preferredMediaType: SearchMediaType,
  fallback: ReturnType<typeof interpretNaturalSearchFallback>,
) {
  const serverUrl = process.env.MOVIESEEKER_AI_SERVER_URL?.trim();
  const token = process.env.MOVIESEEKER_AI_SERVER_TOKEN?.trim();
  if (!serverUrl || !token) return null;

  try {
    const response = await fetch(new URL("/v1/intent", serverUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query,
        preferredMediaType,
        taxonomy: getNaturalSearchTaxonomy(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(readTimeoutMs()),
    });
    // Busy, offline, timed out, or malformed all mean the same thing to the
    // user: search immediately with the deterministic Genre interpretation.
    if (!response.ok) return null;
    const data: unknown = await response.json();
    return validateAiSearchIntent(data, fallback);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: SearchIntentRequest;
  try {
    body = (await request.json()) as SearchIntentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query must contain 1-${MAX_QUERY_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const preferredMediaType: SearchMediaType = body.preferredMediaType === "tv" ? "tv" : "movie";
  const providerIds = normalizeStreamingProviderIds(body.providerIds);
  const fallback = interpretNaturalSearchFallback(query, preferredMediaType);
  const aiIntent = await requestAiIntent(query, preferredMediaType, fallback);
  const source: SearchIntentSource = aiIntent ? "ai" : "genre-fallback";
  const intent = aiIntent ?? fallback;

  return NextResponse.json(
    {
      href: buildNaturalSearchHref(intent, query, source, providerIds),
      source,
      intent,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
