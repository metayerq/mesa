import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mesa — Pilotez vos marges",
  description:
    "Mesa transforme votre POS Vendus en tableau de bord de marges : COGS, seuil de rentabilité, mix produit et réconciliation. Sales analytics gratuit, Profit analytics en Pro.",
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
