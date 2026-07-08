"use client";

import { useEffect } from "react";

export default function GlobalError({
  error
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
