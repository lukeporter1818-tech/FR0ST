"use client";

import { Brain, Menu } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  onToggleSidebar: () => void;
  onToggleAI: () => void;
  aiOpen: boolean;
  userName: string;
  userRole: string;
  userInitials: string;
}

export function TopBar({
  title,
  onToggleSidebar,
  onToggleAI,
  aiOpen,
  userName,
  userRole,
  userInitials,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
        onClick={onToggleSidebar}
      >
        <Menu className="size-4" />
        <span className="sr-only">Toggle sidebar</span>
      </button>

      {/* Page title */}
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleAI}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            aiOpen
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          <Brain className="size-4" />
          <span className="hidden sm:inline">Frost</span>
        </button>

        {/* Divider */}
        <div className="mx-1 h-5 w-px bg-gray-200" />

        {/* User info */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end leading-none">
            <span className="text-xs font-medium text-gray-700">{userName}</span>
            <span className="text-[10px] text-gray-400 capitalize">{userRole.toLowerCase()}</span>
          </div>

          {/* Avatar */}
          <div className="flex size-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {userInitials}
          </div>

          {/* Sign out */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors px-1"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
