import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BundlesLoading() {
  return (
    <main className="min-h-screen px-6 py-6 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="border-b pb-5">
          <div className="h-4 w-24 animate-pulse rounded-md bg-secondary" />
          <div className="mt-3 h-9 w-72 animate-pulse rounded-md bg-secondary" />
        </header>
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <div className="h-4 w-28 animate-pulse rounded-md bg-secondary" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 animate-pulse rounded-md bg-secondary" />
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
