import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeApplier from "@/components/providers/ThemeApplier";
import SettingsPanel from "@/components/layout/SettingsPanel";
import { CredentialsProvider } from "@/lib/context/credentials-context";
import { RequireCredentials } from "@/components/auth/RequireCredentials";
import { ConditionalServiceProvider } from "@/components/providers/ConditionalServiceProvider";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "react-hot-toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://hyperscalper.dev";
const ogImage = `${siteUrl}/landing/hero.png`;

export const metadata: Metadata = {
  title: "Hyperscalper | Advanced Scalping Terminal for Hyperliquid DEX",
  description: "Professional scalping terminal for Hyperliquid. Real-time charts, market scanner, divergence detection & instant execution. 100% client-side — your keys never leave your browser.",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Hyperscalper — Advanced Scalping Terminal for Hyperliquid",
    description: "Professional scalping terminal for Hyperliquid DEX. Real-time charts, market scanner, divergence detection & instant order execution. 100% client-side.",
    siteName: "Hyperscalper",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Hyperscalper Trading Terminal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hyperscalper — Scalping Terminal for Hyperliquid",
    description: "Real-time charts, market scanner, divergence detection & instant execution. 100% client-side — your keys never leave your browser.",
    images: [ogImage],
  },
  authors: [{ name: "Jo Vinkenroye", url: "https://jovweb.dev" }],
  keywords: [
    "Hyperliquid",
    "trading terminal",
    "scalping",
    "crypto trading bot",
    "DEX trading",
    "technical analysis",
    "market scanner",
    "trading signals",
  ],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Hyperscalper",
              url: siteUrl,
              description: "Professional scalping terminal for Hyperliquid DEX with real-time charts, market scanner, and instant order execution.",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              author: {
                "@type": "Person",
                name: "Jo Vinkenroye",
                url: "https://jovweb.dev",
              },
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} subpixel-antialiased`}
        suppressHydrationWarning
      >
        <CredentialsProvider>
          <ThemeApplier />
          <SettingsPanel />
          <RequireCredentials>
            <ConditionalServiceProvider>
              {children}
            </ConditionalServiceProvider>
          </RequireCredentials>
        </CredentialsProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--background-secondary)',
              color: 'var(--primary)',
              border: '1px solid var(--border-frame)',
              fontFamily: 'monospace',
              fontSize: '12px',
            },
            success: {
              icon: null,
              style: {
                border: '1px solid var(--status-bullish)',
              },
            },
            error: {
              icon: null,
              style: {
                border: '1px solid var(--status-bearish)',
              },
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
