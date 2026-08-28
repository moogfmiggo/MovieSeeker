import Link from "next/link";
import { th } from "@/lib/i18n";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{th.home.title}</h1>
      <p className="max-w-md text-lg opacity-70">{th.home.subtitle}</p>
      <Link
        href="/movies"
        className="mt-4 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
      >
        {th.home.cta}
      </Link>
    </main>
  );
}
