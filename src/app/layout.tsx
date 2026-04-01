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
};

// viewport-fit=cover enables env(safe-area-inset-*) on iPhone notch/home-bar devices.
// Without it, safe-area values are always 0 and the input bar overlaps the home indicator.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
