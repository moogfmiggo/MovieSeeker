"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { th } from "@/lib/i18n";

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-accent">
          {th.meta.brand}
        </Link>
        <div className="flex gap-4 text-sm">
          <Link href="/discover" className="text-muted transition hover:text-foreground">
            {th.nav.discover}
          </Link>
          <Link href="/watched" className="text-muted transition hover:text-foreground">
            {th.nav.watched}
          </Link>
          <Link href="/favorites" className="text-muted transition hover:text-foreground">
            {th.nav.favorites}
          </Link>
          <Link href="/streaming" className="text-muted transition hover:text-foreground">
            {th.nav.streaming}
          </Link>
        </div>
      </nav>
    </header>
  );
}
