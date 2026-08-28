import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCompanyDetails, getMoviesByCompany, getWatchProvidersForMovies, TMDBError } from "@/lib/tmdb";
import { summarizeWatchProvidersByMovie } from "@/lib/watchProviders";
import { MovieGrid } from "@/components/MovieGrid";
import { th } from "@/lib/i18n";

const LOGO_BASE_URL = "https://image.tmdb.org/t/p/w342";

// Always fetch live from TMDB at request time — never prerendered at build time.
export const dynamic = "force-dynamic";

function parseId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/company/[id]">): Promise<Metadata> {
  const { id } = await params;
  const companyId = parseId(id);
  if (companyId === null) return { title: th.notFound.title };
  try {
    const company = await getCompanyDetails(companyId);
    return { title: `${company.name} ${th.meta.titleSuffix}` };
  } catch {
    return { title: th.meta.brand };
  }
}

export default async function CompanyPage({ params }: PageProps<"/company/[id]">) {
  const { id } = await params;
  const companyId = parseId(id);
  if (companyId === null) notFound();

  let company;
  let movies;
  try {
    const [companyResult, moviesResult] = await Promise.all([
      getCompanyDetails(companyId),
      getMoviesByCompany(companyId),
    ]);
    company = companyResult;
    movies = moviesResult.results;
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) {
      notFound();
    }
    console.error(
      "[company] failed to load company",
      companyId,
      ":",
      error instanceof Error ? error.message : "unknown error",
    );
    throw new Error("Unable to load this company right now.");
  }

  const rawProviders = await getWatchProvidersForMovies(movies.map((movie) => movie.id));
  const providersByMovieId = summarizeWatchProvidersByMovie(rawProviders);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-32 flex-shrink-0 items-center justify-center rounded-lg bg-foreground/95 p-2">
          {company.logo_path ? (
            <Image
              src={`${LOGO_BASE_URL}${company.logo_path}`}
              alt={company.name}
              width={120}
              height={56}
              className="max-h-11 w-auto object-contain"
            />
          ) : (
            <span className="text-xs text-background/50">{th.common.noLogo}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{company.name}</h1>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">{th.company.movies}</h2>
        <MovieGrid
          movies={movies}
          emptyMessage={th.company.noMoviesFound}
          providersByMovieId={providersByMovieId}
        />
      </section>
    </main>
  );
}
