import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Renaiss Atlas",
  description: "Source-aware liquidity intelligence for the Renaiss collector economy."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
