import { th } from "@/lib/i18n";
import type { TitleSearchMediaType } from "@/lib/titleSearch";

export function TitleSearchPanel({
  initialQuery = "",
  initialMediaType = "movie",
  compact = false,
}: {
  initialQuery?: string;
  initialMediaType?: TitleSearchMediaType;
  compact?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-border bg-surface ${compact ? "p-5 sm:p-6" : "p-6 sm:p-8"}`}>
      <h1 className={`${compact ? "text-xl" : "text-2xl sm:text-3xl"} font-bold tracking-tight`}>
        {th.titleSearch.title}
      </h1>
      <p className="mt-2 text-sm opacity-70">{th.titleSearch.subtitle}</p>
      <form action="/search" method="get" className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">{th.titleSearch.inputLabel}</span>
            <input
              type="search"
              name="q"
              defaultValue={initialQuery}
              required
              maxLength={100}
              placeholder={th.titleSearch.placeholder}
              className="h-12 w-full rounded-full border border-border bg-background px-5 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <button
            type="submit"
            className="h-12 rounded-full bg-accent px-7 text-sm font-semibold text-accent-foreground transition hover:brightness-110"
          >
            {th.titleSearch.submit}
          </button>
        </div>
        <fieldset className="mt-4 flex flex-wrap gap-3">
          <legend className="sr-only">{th.titleSearch.typeLabel}</legend>
          <label className="cursor-pointer">
            <input
              type="radio"
              name="mediaType"
              value="movie"
              defaultChecked={initialMediaType === "movie"}
              className="peer sr-only"
            />
            <span className="inline-flex rounded-full border border-border px-4 py-2 text-sm transition peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-foreground">
              {th.titleSearch.movies}
            </span>
          </label>
          <label className="cursor-pointer">
            <input
              type="radio"
              name="mediaType"
              value="tv"
              defaultChecked={initialMediaType === "tv"}
              className="peer sr-only"
            />
            <span className="inline-flex rounded-full border border-border px-4 py-2 text-sm transition peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-foreground">
              {th.titleSearch.series}
            </span>
          </label>
        </fieldset>
      </form>
    </section>
  );
}
