import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function CardDetailLoading() {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="border-b pb-5">
          <div className="h-8 w-24 animate-pulse rounded-md bg-secondary" />
          <div className="mt-4 h-9 w-full max-w-xl animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-5 w-72 animate-pulse rounded-md bg-secondary" />
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="flex flex-col gap-6">
            {[0, 1, 2].map((item) => (
              <Card key={item}>
                <CardHeader>
                  <div className="h-5 w-40 animate-pulse rounded-md bg-secondary" />
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((metric) => (
                      <div key={metric} className="h-20 animate-pulse rounded-md bg-secondary" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-col gap-6">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-md border bg-secondary" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
