export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="aspect-[2/3] w-40 flex-shrink-0 animate-pulse rounded-lg bg-black/10 sm:w-48" />
        <div className="flex flex-1 flex-col gap-2 pt-2">
          <div className="h-8 w-1/2 animate-pulse rounded bg-black/10" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-black/10" />
          <div className="mt-2 h-16 w-full max-w-2xl animate-pulse rounded bg-black/10" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-lg bg-black/10" />
            <div className="mt-2 h-4 w-3/4 rounded bg-black/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
