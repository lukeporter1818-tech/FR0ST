import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { auth } from "@/lib/auth";
import "./globals.css";
// Leaflet CSS must be in the root layout so it lands in the main CSS bundle,
// not a dynamic chunk that could load after Tailwind Preflight is applied.
import "leaflet/dist/leaflet.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FR0ST",
  description: "Field Operations Platform",
  // Icon strategy — Next.js App Router file-based convention (most reliable):
  //   src/app/apple-icon.png  →  <link rel="apple-touch-icon" href="/_next/static/media/apple-icon.HASH.png">
  //   src/app/icon.png        →  <link rel="icon"             href="/_next/static/media/icon.HASH.png">
  // The HASH changes whenever the file changes, so iOS cannot serve a stale cached icon.
  // manifest covers Android PWA installs and Chrome's install prompt.
  manifest: '/manifest.json',
};

// viewport-fit=cover enables env(safe-area-inset-*) on iPhone notch/home-bar devices.
// Without it, safe-area values are always 0 and the input bar overlaps the home indicator.
// themeColor controls the iOS status-bar tint and Chrome's PWA toolbar colour.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B0F1A',
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-[100dvh] overflow-x-hidden overscroll-x-none antialiased dark`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {session?.user ? (
          <AppShell
            userId={session.user.id ?? ''}
            userName={session.user.name ?? ''}
            userRole={session.user.role ?? 'DISPATCHER'}
            userInitials={getInitials(session.user.name ?? 'U')}
          >
            {/* ErrorBoundary catches unexpected render errors in any page
                component, logs them via /api/telemetry, and shows a minimal
                recovery UI instead of crashing the whole shell. */}
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AppShell>
        ) : (
          children
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
