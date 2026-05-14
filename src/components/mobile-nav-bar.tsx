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
  initialMessageCount?: number;
};

function formatNotificationBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}

function getIconPath(icon: string): string {
  switch (icon) {
    case "feed":
      return "M5 6.5h14M5 12h14M5 17.5h9";
    case "search":
      return "M10.5 17a6.5 6.5 0 1 1 4.6-1.9L20 20";
    case "bell":
      return "M18 10.5v3.8l1.5 2.2H4.5L6 14.3v-3.8a6 6 0 0 1 12 0ZM9.8 19a2.4 2.4 0 0 0 4.4 0";
    case "message":
      return "M5.5 6.5A2.5 2.5 0 0 1 8 4h8a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 16 14h-4.2L7 18v-4H8a2.5 2.5 0 0 1-2.5-2.5v-5Z";
    case "profile":
      return "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0";
    case "group":
      return "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM3.5 19a5 5 0 0 1 9 0M13.5 18.5a4 4 0 0 1 6.5 0";
    default:
      return "M12 5v14M5 12h14";
  }
}

export function MobileNavBar({
  items,
  viewerHandle,
  isAdmin = false,
  viewerId,
  initialNotificationCount = 0,
  initialMessageCount = 0,
}: MobileNavBarProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialNotificationCount);
  const [unreadMessageCount, setUnreadMessageCount] = useState(initialMessageCount);
  const visibleUnreadCount = pathname.startsWith("/notifications") ? 0 : unreadCount;
  const visibleUnreadMessageCount = pathname.startsWith("/messages") ? 0 : unreadMessageCount;

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
    const onMessage = () => {
      if (!pathname.startsWith("/messages")) {
        setUnreadMessageCount((current) => current + 1);
      }
    };
    const onMessagesCleared = () => setUnreadMessageCount(0);

    window.addEventListener("glyph:notifications-changed", onNotification);
    window.addEventListener("glyph:notifications-cleared", onCleared);
    window.addEventListener("glyph:messages-changed", onMessage);
    window.addEventListener("glyph:messages-cleared", onMessagesCleared);

    return () => {
      window.removeEventListener("glyph:notifications-changed", onNotification);
      window.removeEventListener("glyph:notifications-cleared", onCleared);
      window.removeEventListener("glyph:messages-changed", onMessage);
      window.removeEventListener("glyph:messages-cleared", onMessagesCleared);
    };
  }, [pathname, viewerId]);

  return (
    <nav className="app-mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-[var(--line)] bg-[color:color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur lg:hidden">
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={getIconPath(item.icon)} />
                </svg>
                {item.href === "/notifications" && visibleUnreadCount > 0 ? (
                  <span className="absolute -right-2.5 -top-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 py-0.5 text-[9px] font-semibold leading-none text-[var(--page)]">
                    {formatNotificationBadge(visibleUnreadCount)}
                  </span>
                ) : null}
                {item.href === "/messages" && visibleUnreadMessageCount > 0 ? (
                  <span className="absolute -right-2.5 -top-2.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 py-0.5 text-[9px] font-semibold leading-none text-[var(--page)]">
                    {formatNotificationBadge(visibleUnreadMessageCount)}
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
