import Link from "next/link";
import { th } from "@/lib/i18n";

export function NavBar() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-accent">
          {th.meta.brand}
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/movies" className="text-muted transition hover:text-foreground">
            {th.nav.movies}
          </Link>
          <Link href="/preferences" className="text-muted transition hover:text-foreground">
            {th.nav.preferences}
          </Link>
          <Link href="/watched" className="text-muted transition hover:text-foreground">
            {th.nav.watched}
          </Link>
        </div>
      </nav>
    </header>
  );
}
