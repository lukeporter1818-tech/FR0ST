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

  // ── Visual viewport height → CSS variable ────────────────────────────────
  // `100dvh` on iOS Safari does NOT respond to the on-screen keyboard:
  // dvh tracks browser chrome (address bar) visibility, not keyboard events.
  // `window.visualViewport.height` IS accurate — it equals exactly the pixel
  // height the user can see above the keyboard.
  //
  // We write that value into --shell-h on <html> whenever the visual viewport
  // resizes. The shell div reads `var(--shell-h, 100dvh)` as its height,
  // so it always matches the truly visible area. No React state is touched →
  // zero component rerenders on keyboard open/close.
  //
  // Desktop: visualViewport.resize fires on window resize; height stays equal
  // to innerHeight (no keyboard). Behaviour is identical to before. Safe.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      document.documentElement.style.setProperty('--shell-h', `${vv.height}px`)
    }
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  // ── Scroll-drift guard ────────────────────────────────────────────────────
  // On iOS Safari, while the keyboard animates open/close, the browser may
  // briefly scroll window.scrollY non-zero. Since the shell is position:fixed,
  // any non-zero scrollY shifts the visual viewport past the shell, leaving a
  // blank gap. Reset it immediately whenever it drifts.
  // Android: scrollY stays 0 on keyboard events — guard never fires. Safe.
  // Desktop: no keyboard, events do not fire. Safe.
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
      className="flex fixed inset-x-0 top-0 overflow-hidden bg-[#0f1117]"
      style={{ height: 'var(--shell-h, 100dvh)' }}
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
