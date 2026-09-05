import { th } from "@/lib/i18n";
import type { TitleSearchMediaType } from "@/lib/titleSearch";

export function TitleSearchPanel({
  initialQuery = "",
  initialMediaType = "movie",
}: {
  initialQuery?: string;
  initialMediaType?: TitleSearchMediaType;
}) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label={th.titleSearch.title}
      className="ml-auto flex w-full max-w-xl items-center gap-1 rounded-full border border-border bg-surface p-1 transition focus-within:border-accent/60"
    >
      <label className="min-w-0 flex-1">
        <span className="sr-only">{th.titleSearch.inputLabel}</span>
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          required
          maxLength={100}
          placeholder={th.titleSearch.compactPlaceholder}
          className="h-9 w-full rounded-full bg-transparent px-3 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent/40"
        />
      </label>
      <label>
        <span className="sr-only">{th.titleSearch.typeLabel}</span>
        <select
          name="mediaType"
          defaultValue={initialMediaType}
          className="h-9 rounded-full bg-surface px-2 text-xs text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <option value="movie">{th.common.movieLabel}</option>
          <option value="tv">{th.common.seriesLabel}</option>
        </select>
      </label>
      <button
        type="submit"
        aria-label={th.titleSearch.submit}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </button>
    </form>
  );
}
