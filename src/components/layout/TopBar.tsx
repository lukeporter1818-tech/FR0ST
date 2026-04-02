"use client";

import { Menu } from "lucide-react";
import { signOut } from "next-auth/react";

interface TopBarProps {
  title: string;
  onToggleSidebar: () => void;
  userName: string;
  userRole: string;
  userInitials: string;
}

export function TopBar({
  title,
  onToggleSidebar,
  userName,
  userRole,
  userInitials,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-gray-950 px-6">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="size-4" />
        <span className="sr-only">Toggle sidebar</span>
      </button>

      {/* Page title — flex-1 min-w-0 lets it shrink instead of pushing the right rail off screen */}
      <h1 className="flex-1 min-w-0 truncate text-base font-semibold text-white">{title}</h1>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-xs font-medium text-gray-200">{userName}</span>
            <span className="text-[10px] text-gray-500 capitalize">{userRole.toLowerCase()}</span>
          </div>

          {/* Avatar */}
          <div className="flex size-8 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-gray-950">
            {userInitials}
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
