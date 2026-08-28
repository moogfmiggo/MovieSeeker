import Link from "next/link";
import { th } from "@/lib/i18n";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-xl font-semibold">{th.notFound.title}</h1>
      <p className="max-w-sm text-sm opacity-70">{th.notFound.body}</p>
      <Link
        href="/"
        className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
      >
        {th.notFound.backHome}
      </Link>
    </main>
  );
}
