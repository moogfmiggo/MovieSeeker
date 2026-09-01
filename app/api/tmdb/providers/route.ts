import { NextResponse } from "next/server";
import { getWatchProvidersForMovies } from "@/lib/tmdb";
import { withTimeoutFallback } from "@/lib/timeout";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";

export const dynamic = "force-dynamic";

const MAX_MOVIES_PER_REQUEST = 20;
const WATCH_PROVIDERS_TIMEOUT_MS = 3000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = [...new Set(
    (searchParams.get("ids") ?? "")
      .split(",")
      .map((raw) => Number(raw.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  )].slice(0, MAX_MOVIES_PER_REQUEST);

  const rawProviders = await withTimeoutFallback(
    getWatchProvidersForMovies(ids),
    WATCH_PROVIDERS_TIMEOUT_MS,
    {},
  );
  return NextResponse.json({
    providers: summarizeWatchProvidersByMovie(rawProviders),
  });
}
