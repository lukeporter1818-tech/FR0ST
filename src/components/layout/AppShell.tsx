"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { logPageView } from "@/lib/client-telemetry";

const pageTitles: Record<string, string> = {
  "/ai": "Frost",
  "/chat": "Team Chat",
  "/schedule": "Schedule",
  "/management": "Management",
  "/technicians": "Technicians",
  "/settings/users": "User Management",
  "/stores": "Service Locations",
  "/settings/ai-interactions": "Frost Learning Log",
  "/jobs": "Jobs",
  "/jobs/new": "New Job",
  "/map": "Service Map",
};

function resolveTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];

  // Match longest prefix for nested routes
  const match = Object.entries(pageTitles)
    .filter(([key]) => key !== "/" && pathname.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length)[0];

  return match ? match[1] : "FR0ST";
}

interface AppShellProps {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
  userInitials?: string;
}

export function AppShell({
  children,
  userName = "User",
  userRole = "DISPATCHER",
  userInitials = "U",
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), []);

  const title = resolveTitle(pathname);

  // ── Page-view telemetry ───────────────────────────────────────────────────
  // Log which core screen the user is on whenever the pathname changes.
  // Only fires for the four primary operational surfaces — not every sub-route.
  // Deduplication in logPageView prevents duplicate fires on re-renders.
  useEffect(() => {
    const SCREENS: Record<string, string> = {
      '/schedule':   'schedule',
      '/chat':       'chat',
      '/management': 'management',
      '/ai':         'frost',
    }
    const screen = SCREENS[pathname]
    if (screen) logPageView(screen)
  }, [pathname])

  // ── Mobile keyboard sizing + scroll-drift guard ──────────────────────────
  // Two separate mechanisms work together here:
  //
  // 1. Shell height: the outer div uses `h-[100dvh]` instead of `bottom:0`
  //    (which `inset-0` would set). `100dvh` tracks the *dynamic* viewport
  //    height — it shrinks when the keyboard opens on iOS 15.4+ and
  //    Chrome 108+. This means the shell itself shrinks above the keyboard,
  //    and <main>'s overflow-y-auto can reveal any content that would otherwise
  //    sit behind it. Older browsers fall back to 100vh (no regression).
  //
  // 2. Scroll-drift guard (below): on iOS Safari, even with h-[100dvh],
  //    the browser may momentarily scroll window.scrollY while animating the
  //    keyboard open/close. Since the shell is position:fixed, any non-zero
  //    scrollY shifts the visual viewport past the shell, leaving blank space.
  //    Fix: reset scrollY to 0 whenever it drifts non-zero.
  //    Android does not exhibit this behaviour (scrollY stays 0). Safe.
  //    Desktop: no keyboard, events never fire. Safe.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const resetScroll = () => {
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0)
      }
    }

    vv.addEventListener('scroll', resetScroll)
    vv.addEventListener('resize', resetScroll)

    return () => {
      vv.removeEventListener('scroll', resetScroll)
      vv.removeEventListener('resize', resetScroll)
    }
  }, [])

  return (
    <div
      className="flex fixed inset-x-0 top-0 h-[100dvh] overflow-hidden bg-[#0f1117]"
    >
      <Sidebar userRole={userRole} userName={userName} userInitials={userInitials} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[1010] bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0 pl-0 lg:pl-60">
        <TopBar
          title={title}
          onToggleSidebar={toggleSidebar}
          userName={userName}
          userRole={userRole}
          userInitials={userInitials}
        />

        {/*
          Full-height pages (/chat, /ai, /management) must be a flex column
          so the flex-1 chain is unbroken all the way to the input bar.
          min-h-0 at every level lets each node shrink when dvh updates
          (keyboard opens on iOS). Without min-h-0, min-height:auto stops
          the shrink at the messages area and the input bar stays hidden
          under the keyboard.
          All other pages get the standard scrollable padded container.
          overflow-x-hidden on standard pages is an extra guard against any
          child element accidentally widening the content column.
        */}
        <main className={
          pathname === '/chat' || pathname === '/ai' || pathname === '/management' || pathname === '/map'
            ? 'flex-1 flex flex-col overflow-hidden min-h-0'
            : 'flex-1 overflow-y-auto overflow-x-hidden p-6'
        }>
          {children}
        </main>
      </div>
    </div>
  );
}
