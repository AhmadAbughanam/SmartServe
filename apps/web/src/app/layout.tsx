import type { Metadata } from "next";
import { Providers } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Restaurant OS",
  description: "Unified frontend scaffold for customer and operations workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
