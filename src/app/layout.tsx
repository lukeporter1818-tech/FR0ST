import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { auth } from "@/lib/auth";
import "./globals.css";

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
  // PWA / home-screen icon wiring.
  // apple-touch-icon is the one iOS reads when the user taps "Add to Home Screen".
  // manifest provides the icon set for Android / Chrome PWA installs.
  // Next.js injects these as <link> tags in <head> automatically.
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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
      className={`${geistSans.variable} ${geistMono.variable} h-[100dvh] overflow-x-hidden antialiased dark`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden">
        {session?.user ? (
          <AppShell
            userName={session.user.name ?? ''}
            userRole={session.user.role ?? 'DISPATCHER'}
            userInitials={getInitials(session.user.name ?? 'U')}
          >
            {children}
          </AppShell>
        ) : (
          children
        )}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
