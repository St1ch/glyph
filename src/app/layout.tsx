import type { Metadata } from "next";
import { Handjet } from "next/font/google";
import Link from "next/link";
import Script from "next/script";
import { CookieNotice, DesktopSiteNotifications, MobileNavBar, NavLink, RealtimeBridge } from "@/components/client";
import { AvatarBubble } from "@/components/server";
import { getUnreadNotificationCount, getViewer } from "@/lib/data";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const handjet = Handjet({
  variable: "--font-handjet",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "GLYPH",
    template: "%s · GLYPH",
  },
  description: siteConfig.description,
};

export const dynamic = "force-dynamic";

const themeScript = `
  (function () {
    try {
      var stored = window.localStorage.getItem("glyph-theme") || "system";
      var resolved = stored === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : stored;
      document.documentElement.dataset.theme = resolved;
    } catch (error) {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const viewer = await getViewer();
  const unreadNotificationCount = viewer ? await getUnreadNotificationCount(viewer.id) : 0;

  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${handjet.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--page)] font-[var(--font-handjet)] text-[var(--text)]">
        <Script id="glyph-theme-script" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {viewer ? <RealtimeBridge viewerId={viewer.id} /> : null}
        {viewer ? <DesktopSiteNotifications viewerId={viewer.id} enabled={viewer.notificationsEnabled} /> : null}

        <header className="fixed inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--page)_82%,transparent)] backdrop-blur lg:hidden">
          <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-semibold tracking-tight">{siteConfig.name}</span>
              <span className="text-xs text-[var(--muted)]">{siteConfig.version}</span>
            </Link>
            {viewer ? (
              <Link href={`/profile/${viewer.handle}`} className="shrink-0">
                <AvatarBubble avatar={viewer.avatar} name={viewer.name} size="sm" />
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-full bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--page)] hover:opacity-90"
              >
                Войти
              </Link>
            )}
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1040px] gap-6 lg:px-4">
          <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[240px] shrink-0 flex-col justify-between py-4 lg:flex">
            <div className="grid gap-6">
              <Link href="/" className="flex items-center gap-3 px-3 py-2">
                <span className="text-xl font-semibold tracking-tight">{siteConfig.name}</span>
                <span className="text-xs text-[var(--muted)]">{siteConfig.version}</span>
              </Link>

              <nav className="grid gap-2">
                {siteConfig.navigation.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    viewerId={viewer?.id}
                    initialNotificationCount={item.href === "/notifications" ? unreadNotificationCount : 0}
                  />
                ))}
                {viewer ? (
                  <>
                    <NavLink href="/clans" label="Кланы" icon="group" viewerId={viewer.id} />
                    <NavLink href={`/profile/${viewer.handle}`} label="Профиль" icon="profile" viewerId={viewer.id} />
                    {viewer.isAdmin ? <NavLink href="/admin" label="Админка" icon="bell" viewerId={viewer.id} /> : null}
                  </>
                ) : null}
              </nav>
            </div>

            {viewer ? (
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)]">
                <Link href={`/profile/${viewer.handle}`} className="flex items-center gap-3">
                  <AvatarBubble avatar={viewer.avatar} name={viewer.name} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{viewer.name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">@{viewer.handle}</div>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)]">
                <div className="text-sm leading-6 text-[var(--muted)]">
                  Войдите, чтобы публиковать посты, подписываться на людей и управлять своим профилем.
                </div>
              </div>
            )}
          </aside>

          <main className="flex min-h-screen min-w-0 flex-1 flex-col">
            <div className="w-full pb-24 pt-16 lg:pb-8 lg:pt-4">{children}</div>
          </main>
        </div>

        <CookieNotice />
        <MobileNavBar
          items={siteConfig.navigation}
          viewerHandle={viewer?.handle}
          isAdmin={viewer?.isAdmin}
          viewerId={viewer?.id}
          initialNotificationCount={unreadNotificationCount}
        />
      </body>
    </html>
  );
}
