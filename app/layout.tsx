import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeApplier from "@/components/providers/ThemeApplier";
import SettingsPanel from "@/components/layout/SettingsPanel";
import { CredentialsProvider } from "@/lib/context/credentials-context";
import { RequireCredentials } from "@/components/auth/RequireCredentials";
import { ConditionalServiceProvider } from "@/components/providers/ConditionalServiceProvider";
import { Analytics } from "@vercel/analytics/next";

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
        <Analytics />
      </body>
    </html>
  );
}
