"use client";

export default function GlobalError({
  error
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1>Renaiss Atlas failed to start.</h1>
          <p>{error.message}</p>
        </main>
      </body>
    </html>
  );
}
