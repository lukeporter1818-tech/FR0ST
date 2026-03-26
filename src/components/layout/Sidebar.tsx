"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench,
  LayoutList,
  MessageSquare,
  Bot,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primaryNavItems = [
  { label: "Schedule", href: "/", icon: LayoutList },
  { label: "Team Chat", href: "/chat", icon: MessageSquare },
  { label: "Frost", href: "/ai", icon: Bot },
] as const;

const secondaryNavItems = [
  { label: "Technicians", href: "/technicians", icon: Users, roles: ["DISPATCHER", "ADMIN"] },
  { label: "Users", href: "/settings/users", icon: Users, roles: ["ADMIN"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: null },
] as const;

interface SidebarProps {
  userRole?: string;
  userName?: string;
  userInitials?: string;
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ userRole, userName, userInitials, open, onClose }: SidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  function NavItem({
    label,
    href,
    icon: Icon,
    secondary = false,
  }: {
    label: string;
    href: string;
    icon: React.ElementType;
    secondary?: boolean;
  }) {
    const active = isActive(href);
    return (
      <li>
        <Link
          href={href}
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
            secondary ? "text-xs font-medium" : "text-sm font-medium",
            active
              ? "bg-white/10 text-white"
              : secondary
              ? "text-gray-500 hover:bg-white/5 hover:text-gray-400"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          )}
        >
          <Icon
            className={cn(
              "shrink-0",
              secondary ? "size-3.5" : "size-4",
              active
                ? "text-amber-400"
                : secondary
                ? "text-gray-600"
                : "text-gray-500"
            )}
          />
          {label}
        </Link>
      </li>
    );
  }

  const visibleSecondaryItems = secondaryNavItems.filter((item) => {
    if (!item.roles) return true;
    if (!userRole) return true;
    return (item.roles as readonly string[]).includes(userRole);
  });

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-gray-950 transition-transform duration-200 ease-in-out",
      open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/15">
            <Wrench className="size-4 text-amber-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            FieldCommand
          </span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
            aria-label="Close menu"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Primary section */}
        <ul className="flex flex-col gap-0.5">
          {primaryNavItems.map(({ label, href, icon }) => (
            <NavItem key={href} label={label} href={href} icon={icon} />
          ))}
        </ul>

        {/* Divider */}
        <div className="my-4 border-t border-white/10" />

        {/* Secondary section */}
        <ul className="flex flex-col gap-0.5">
          {visibleSecondaryItems.map(({ label, href, icon }) => (
            <NavItem
              key={href}
              label={label}
              href={href}
              icon={icon}
              secondary
            />
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-200">
            {userInitials ?? (userRole?.[0] ?? 'U')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-300">
              {userName ?? userRole ?? 'User'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {userRole?.toLowerCase() ?? 'field'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
