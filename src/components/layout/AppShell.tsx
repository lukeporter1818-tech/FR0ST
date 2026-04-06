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
  "/settings": "Settings",
  "/settings/users": "User Management",
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

  // ── Mobile keyboard auto-settling ────────────────────────────────────────
  // Problem: when the keyboard opens on iOS, Safari scrolls window.scrollY
  // to bring the focused input "into view" — standard browser behaviour that
  // works for normal pages but is wrong for a position:fixed; inset:0 shell.
  // The page scroll shifts the visual viewport DOWN past the fixed shell:
  // the user sees blank space and the entire UI is above the visible area.
  // They must manually scroll UP to re-align — this is the settling bug.
  //
  // Fix: whenever window.scrollY becomes non-zero (visual viewport has
  // drifted from the fixed shell), reset it to 0 immediately.
  // Since AppShell is fixed inset-0, the correct scroll position is always 0.
  // Any non-zero value is iOS "helping" with a focused input — always wrong.
  //
  // We listen to visualViewport.scroll (fires when offsetTop changes due to
  // page scroll) AND visualViewport.resize (keyboard open/close animation,
  // where iOS sometimes adjusts scrollY mid-animation as a safety net).
  //
  // Android: does not scroll window.scrollY on keyboard open — scrollY stays 0,
  // the guard `scrollY !== 0` is always false, scrollTo is never called. Safe.
  //
  // Desktop: keyboard never opens, events don't fire for scroll. Safe.
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
      className="flex fixed inset-0 overflow-hidden bg-[#0f1117]"
    >
      <Sidebar userRole={userRole} userName={userName} userInitials={userInitials} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
