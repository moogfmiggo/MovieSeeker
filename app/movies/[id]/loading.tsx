export default function Loading() {
  return (
    <main>
      <div className="bg-neutral-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:flex-row sm:px-6 sm:py-12">
          <div className="aspect-[2/3] w-40 flex-shrink-0 animate-pulse rounded-lg bg-white/10 sm:w-56" />
          <div className="flex flex-1 flex-col justify-end gap-3 pb-2">
            <div className="h-8 w-2/3 animate-pulse rounded bg-white/10" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
            <div className="h-11 w-40 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
        <div className="mt-2 h-16 w-full max-w-3xl animate-pulse rounded bg-black/10" />
        <div className="mt-8 flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-24 flex-shrink-0 animate-pulse sm:w-28">
              <div className="aspect-square rounded-full bg-black/10" />
              <div className="mt-2 h-3 w-full rounded bg-black/10" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
