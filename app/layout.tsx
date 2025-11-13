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

export const metadata: Metadata = {
  title: "Hyperscalper | Advanced Trading Terminal for Hyperliquid",
  description: "Professional scalping terminal for Hyperliquid DEX. Real-time charts, advanced indicators, market scanner, and instant order execution. No backend, your keys never leave your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
