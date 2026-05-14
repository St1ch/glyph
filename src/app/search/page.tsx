import type { Metadata } from "next";
import Link from "next/link";
import { FollowButton, JoinClanButton } from "@/components/client";
import { AvatarBubble, EmptyState, VerificationBadge } from "@/components/server";
import { getSearchData } from "@/lib/data";
import type { Group, User } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

type Viewer = User | null;

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = (params.q ?? "").trim();

  return {
    title: query ? `Поиск: ${query}` : "Поиск",
    description: query
      ? `Результаты поиска по запросу «${query}» в GLYPH: пользователи и кланы.`
      : "Поиск пользователей и кланов в социальной платформе GLYPH.",
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: "/search",
    },
  };
}

function SearchUserRow({ user, viewer }: { user: User; viewer: Viewer }) {
  const isOwn = viewer?.id === user.id;
  const isFollowing = viewer ? viewer.followingIds.includes(user.id) : false;

  return (
    <div className="flex items-center gap-3 rounded-[22px] p-3 transition hover:bg-white/[0.035]">
      <Link href={`/profile/${user.handle}`} className="shrink-0">
        <AvatarBubble avatar={user.avatar} name={user.name} />
      </Link>
      <Link href={`/profile/${user.handle}`} className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-[var(--text)]">{user.name}</span>
          <VerificationBadge status={user.verificationStatus} />
        </div>
        <div className="mt-0.5 text-sm text-[var(--muted)]">@{user.handle}</div>
        <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{user.bio}</p>
      </Link>
      {!isOwn ? <FollowButton handle={user.handle} isFollowing={isFollowing} disabled={!viewer} /> : null}
    </div>
  );
}

function SearchClanRow({ group, viewer }: { group: Group; viewer: Viewer }) {
  const joined = viewer ? group.memberIds.includes(viewer.id) : false;

  return (
    <div className="flex items-center gap-3 rounded-[22px] p-3 transition hover:bg-white/[0.035]">
      <Link href={`/clan/${group.slug}`} className="shrink-0">
        <AvatarBubble avatar={group.avatar} name={group.name} />
      </Link>
      <Link href={`/clan/${group.slug}`} className="min-w-0 flex-1">
        <div className="truncate font-semibold text-[var(--text)]">{group.name}</div>
        <div className="mt-0.5 text-sm text-[var(--muted)]">@{group.slug}</div>
        <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">{group.description}</p>
      </Link>
      <JoinClanButton slug={group.slug} joined={joined} disabled={!viewer} />
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const { viewer, users, groups } = await getSearchData(query);
  const hasQuery = Boolean(query.trim());

  return (
    <div className="flex w-full max-w-[900px] flex-col gap-5 px-4 py-6 min-[2400px]:max-w-[1120px]">
      <section className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] sm:p-5">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Поиск</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Найдите человека по имени или username, а клан по названию, slug или описанию.
          </p>
        </div>
        <form action="/search" className="flex gap-3">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Поисковый запрос</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Например: Москва, дизайн, cloud"
              className="h-12 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-5 text-sm outline-none transition focus:border-[var(--accent)]/70"
            />
          </label>
          <button className="h-12 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--page)] hover:opacity-90">
            Найти
          </button>
        </form>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)]">
        <div className="border-b border-[var(--line)] px-4 py-3 text-sm font-semibold text-[var(--muted)]">
          {hasQuery ? `Результаты по запросу «${query.trim()}»` : "Рекомендации и доступные профили"}
        </div>

        <div className="grid divide-y divide-[var(--line)]">
          <div className="p-3">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Люди</div>
            {users.length ? (
              <div className="grid gap-1">
                {users.map((user) => (
                  <SearchUserRow key={user.id} user={user} viewer={viewer} />
                ))}
              </div>
            ) : (
              <EmptyState title="Люди не найдены" description="Попробуйте другой запрос или проверьте написание username." />
            )}
          </div>

          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-3 px-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Кланы</div>
              <Link
                href="/clan/create"
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:bg-white/[0.04] hover:text-[var(--text)]"
              >
                Создать клан
              </Link>
            </div>
            {groups.length ? (
              <div className="grid gap-1">
                {groups.map((group) => (
                  <SearchClanRow key={group.id} group={group} viewer={viewer} />
                ))}
              </div>
            ) : (
              <EmptyState title="Кланы не найдены" description="Можно создать новый клан и собрать вокруг него участников." />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
