export default function Loading() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="h-8 w-48 animate-pulse rounded-md bg-secondary" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-36 animate-pulse rounded-md bg-secondary" />
          <div className="h-36 animate-pulse rounded-md bg-secondary" />
          <div className="h-36 animate-pulse rounded-md bg-secondary" />
        </div>
      </div>
    </main>
  );
}
