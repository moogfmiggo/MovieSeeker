export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center gap-4">
        <div className="h-16 w-32 animate-pulse rounded-lg bg-surface" />
        <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-[2/3] rounded-lg bg-surface" />
            <div className="mt-2 h-4 w-3/4 rounded bg-surface" />
          </div>
        ))}
      </div>
    </main>
  );
}
