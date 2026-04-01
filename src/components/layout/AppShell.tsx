"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

const pageTitles: Record<string, string> = {
  "/ai": "Frost",
  "/chat": "Team Chat",
  "/schedule": "Schedule",
  "/management": "Management",
  "/overview": "Daily Snapshot",
  "/technicians": "Technicians",
  "/settings": "Settings",
  "/settings/users": "User Management",
  "/settings/ai-interactions": "Frost Learning Log",
  "/jobs": "Schedule",
  "/jobs/new": "New Job",
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
          pathname === '/chat' || pathname === '/ai' || pathname === '/management'
            ? 'flex-1 flex flex-col overflow-hidden min-h-0'
            : 'flex-1 overflow-y-auto overflow-x-hidden p-6'
        }>
          {children}
        </main>
      </div>
    </div>
  );
}
