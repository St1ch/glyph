"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { joinClasses } from "@/lib/site";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

type MobileNavBarProps = {
  items: readonly NavItem[];
  viewerHandle?: string;
  isAdmin?: boolean;
  viewerId?: string;
  initialNotificationCount?: number;
};

function formatNotificationBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}

function getIconPath(icon: string): string {
  switch (icon) {
    case "feed":
      return "M3 3h18v2H3V3zm0 8h18v2H3v-2zm0 8h18v2H3v-2z";
    case "search":
      return "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
    case "bell":
      return "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z";
    case "message":
      return "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z";
    case "profile":
      return "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";
    case "group":
      return "M7 11.5c0-1.66-1.34-3-3-3s-3 1.34-3 3V14h6v-2.5zM4 8c1.38 0 2.5-1.12 2.5-2.5S5.38 3 4 3 1.5 4.12 1.5 5.5 2.62 8 4 8zm9 0c1.38 0 2.5-1.12 2.5-2.5S14.38 3 13 3s-2.5 1.12-2.5 2.5S11.62 8 13 8zm-1 0.5h-1c-1.93 0-3.5 1.57-3.5 3.5V14h9v-2c0-1.93-1.57-3.5-3.5-3.5z";
    default:
      return "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z";
  }
}

export function MobileNavBar({
  items,
  viewerHandle,
  isAdmin = false,
  viewerId,
  initialNotificationCount = 0,
}: MobileNavBarProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialNotificationCount);
  const visibleUnreadCount = pathname.startsWith("/notifications") ? 0 : unreadCount;

  const navItems = viewerHandle
    ? [
        ...items,
        { href: "/clans", label: "Кланы", icon: "group" },
        { href: `/profile/${viewerHandle}`, label: "Профиль", icon: "profile" },
        ...(isAdmin ? [{ href: "/admin", label: "Админ", icon: "bell" }] : []),
      ]
    : [...items];

  useEffect(() => {
    if (!viewerId || typeof window === "undefined") {
      return;
    }

    const onNotification = () => {
      if (!pathname.startsWith("/notifications")) {
        setUnreadCount((current) => current + 1);
      }
    };
    const onCleared = () => setUnreadCount(0);

    window.addEventListener("glyph:notifications-changed", onNotification);
    window.addEventListener("glyph:notifications-cleared", onCleared);

    return () => {
      window.removeEventListener("glyph:notifications-changed", onNotification);
      window.removeEventListener("glyph:notifications-cleared", onCleared);
    };
  }, [pathname, viewerId]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[color:color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur lg:hidden">
      <div
        className="mx-auto grid max-w-[640px] px-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] pt-2"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={joinClasses(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[18px] px-1.5 py-2 text-center transition",
                isActive
                  ? "bg-[var(--panel)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]",
              )}
            >
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill={isActive ? "currentColor" : "none"}
                  stroke={isActive ? "none" : "currentColor"}
                  strokeWidth={isActive ? "0" : "2"}
                  aria-hidden="true"
                >
                  <path d={getIconPath(item.icon)} />
                </svg>
                {item.href === "/notifications" && visibleUnreadCount > 0 ? (
                  <span className="absolute -right-2.5 -top-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 py-0.5 text-[9px] font-semibold leading-none text-[var(--page)]">
                    {formatNotificationBadge(visibleUnreadCount)}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
