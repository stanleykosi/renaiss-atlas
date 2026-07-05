import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function IntentsLoading() {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="border-b pb-5">
          <div className="h-4 w-20 animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-9 w-64 animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-md bg-secondary" />
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-md border bg-secondary" />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader>
              <div className="h-5 w-40 animate-pulse rounded-md bg-secondary" />
            </CardHeader>
            <CardContent>
              <div className="h-96 animate-pulse rounded-md bg-secondary" />
            </CardContent>
          </Card>
          <div className="grid gap-6">
            {[0, 1].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-md border bg-secondary" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
