import { NextResponse } from "next/server";
import {
  getTVSeriesByIds,
  getWatchProvidersForTVSeries,
  TMDBConfigError,
  TMDBError,
} from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "")
    .split(",")
    .map((raw) => Number(raw.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) return NextResponse.json({ results: [] });

  try {
    const series = await getTVSeriesByIds(ids);
    const rawProviders = await getWatchProvidersForTVSeries(series.map((item) => item.id));
    const providers = summarizeWatchProvidersByMovie(rawProviders);
    return NextResponse.json({ results: series, providers });
  } catch (error) {
    if (error instanceof TMDBConfigError) {
      console.error("[tmdb series] configuration error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (error instanceof TMDBError) {
      console.error("[tmdb series] request failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error(
      "[tmdb series] unexpected error:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
