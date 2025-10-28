import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalBTCProvider from "@/components/providers/GlobalBTCProvider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <GlobalBTCProvider />
        <SettingsPanel />
        {children}
      </body>
    </html>
  );
}
