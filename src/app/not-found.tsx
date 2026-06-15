import Link from "next/link";
import { siteConfig } from "@/lib/site";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[calc(100vh-6rem)] items-center justify-center px-4 py-10">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[8%] top-[14%] h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_14%,transparent)] blur-3xl" />
        <div className="absolute right-[10%] top-[20%] h-56 w-56 rounded-full bg-white/[0.05] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]" />
      </div>

      <div className="relative w-full max-w-[760px] rounded-[32px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,transparent)] p-6 shadow-[0_30px_80px_-55px_rgba(0,0,0,0.9)] sm:p-10">
        <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
          <div>
            <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              {siteConfig.name}
            </div>
            <h1 className="mt-4 text-6xl font-semibold tracking-tight sm:text-7xl">
              404
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Страница потерялась. Возможно, ссылка устарела, была удалена или вы просто свернули не туда.
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-5">
            <div className="grid gap-3 text-sm leading-6 text-[var(--muted)]">
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                Проверьте адрес или вернитесь в ленту.
              </div>
              <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
                Если искали пост, профиль или клан, попробуйте поиск.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-center text-sm font-semibold text-[var(--page)] hover:opacity-90"
          >
            На главную
          </Link>
          <Link
            href="/search"
            className="rounded-full border border-[var(--line)] px-5 py-3 text-center text-sm font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
          >
            Поиск
          </Link>
        </div>
      </div>
    </div>
  );
}
