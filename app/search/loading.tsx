export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6 sm:py-10">
      <div className="h-48 rounded-xl bg-surface" />
      <div className="mt-10 h-8 w-72 rounded bg-surface" />
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] rounded-lg bg-surface" />
        ))}
      </div>
    </main>
  );
}
