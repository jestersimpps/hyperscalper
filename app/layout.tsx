import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SymbolMetaHydrator from "@/components/providers/SymbolMetaHydrator";
import ThemeApplier from "@/components/providers/ThemeApplier";
import SettingsPanel from "@/components/layout/SettingsPanel";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BTC-USD Live Chart | Hyperliquid",
  description: "Real-time Bitcoin perpetual futures candlestick chart powered by Hyperliquid API",
};

async function fetchSymbolMetadata() {
  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
      cache: 'force-cache',
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch symbol metadata');
    }

    return await response.json();
  } catch (error) {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const symbolMetadata = await fetchSymbolMetadata();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SymbolMetaHydrator initialData={symbolMetadata} />
        <ThemeApplier />
        <SettingsPanel />
        {children}
      </body>
    </html>
  );
}
