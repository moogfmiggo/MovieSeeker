import Link from "next/link";
import { th } from "@/lib/i18n";

export function NavBar() {
  return (
    <header className="border-b border-black/10">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {th.meta.brand}
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/movies" className="opacity-70 transition hover:opacity-100">
            {th.nav.movies}
          </Link>
          <Link href="/preferences" className="opacity-70 transition hover:opacity-100">
            {th.nav.preferences}
          </Link>
          <Link href="/watched" className="opacity-70 transition hover:opacity-100">
            {th.nav.watched}
          </Link>
        </div>
      </nav>
    </header>
  );
}
