import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa — Know your margins",
  description:
    "Mesa turns your Vendus POS into a margin dashboard: COGS, daily break-even, product mix and reconciliation. Sales analytics free forever, Profit analytics in Pro.",
};

export const viewport: Viewport = {
  themeColor: "#EDEAE3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
