import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  FollowButton,
  PostComposer,
  ProfileSettingsModal,
  SettingsModal,
  VerificationModal,
} from "@/components/client";
import { AvatarBubble, EmptyState, PostCard, VerificationBadge } from "@/components/server";
import { getProfileData } from "@/lib/data";
import { formatters, joinClasses } from "@/lib/site";

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const data = await getProfileData(handle, "posts");

  if (!data) {
    return {
      title: "Профиль не найден",
      description: "Запрошенный профиль в GLYPH не найден.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { user, contentLocked } = data;

  return {
    title: `${user.name} (@${user.handle})`,
    description: contentLocked
      ? `Приватный профиль пользователя @${user.handle} в GLYPH.`
      : user.bio || `Профиль пользователя @${user.handle} в социальной платформе GLYPH.`,
    alternates: {
      canonical: `/profile/${user.handle}`,
    },
  };
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const data = await getProfileData(handle, query.tab ?? "posts");

  if (!data) {
    return (
      <div className="w-full max-w-[760px] px-4 py-6 min-[2400px]:max-w-[980px]">
        <EmptyState
          title="Профиль не найден"
          description="Проверьте username в адресной строке или найдите нужного человека через поиск."
        />
      </div>
    );
  }

  const { viewer, user, activeTab, contentLocked, posts, likedPosts } = data;
  const isOwn = viewer?.id === user.id;
  const isFollowing = viewer ? viewer.followingIds.includes(user.id) : false;

  const tabItems = [
    { key: "posts", label: "Посты", href: `/profile/${user.handle}?tab=posts` },
    { key: "likes", label: "Лайки", href: `/profile/${user.handle}?tab=likes` },
  ] as const;

  const currentItems = activeTab === "posts" ? posts : likedPosts;

  return (
      <div className="flex w-full max-w-[760px] flex-col gap-4 px-4 py-6 min-[2400px]:max-w-[980px]">
      <section className="overflow-hidden rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_24px_60px_-45px_rgba(0,0,0,0.9)]">
        <div className="relative h-40 w-full sm:h-48">
          {user.coverImage ? (
            <Image src={user.coverImage} alt={user.name} width={1600} height={400} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(132,184,44,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.34))]" />
          )}
        </div>

        <div className="relative px-4 pb-5 sm:px-5">
          <div className="-mt-8 flex flex-col gap-4 md:-mt-10 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-3 rounded-[24px] bg-[linear-gradient(90deg,rgba(0,0,0,0.38)_0%,rgba(0,0,0,0.26)_72%,rgba(0,0,0,0)_100%)] px-3 py-2 backdrop-blur-[2px]">
              <div className="shrink-0">
                <AvatarBubble avatar={user.avatar} name={user.name} size="lg" />
              </div>
              <div className="pb-1 [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
                  <VerificationBadge status={user.verificationStatus} />
                </div>
                <div className="mt-0.5 text-sm text-white/78">@{user.handle}</div>
              </div>
            </div>

            {viewer ? (
              isOwn ? (
                <div className="flex flex-wrap gap-2 rounded-[22px] bg-black/22 p-1.5 backdrop-blur-[2px] md:justify-end">
                  <ProfileSettingsModal user={user} />
                  <VerificationModal status={user.verificationStatus} />
                  <SettingsModal user={user} />
                </div>
              ) : (
                <FollowButton handle={user.handle} isFollowing={isFollowing} />
              )
            ) : (
              <Link
                href="/auth/login"
                className="w-full rounded-full border border-[var(--line)] px-5 py-3 text-center text-sm font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] sm:w-auto"
              >
                Войти и подписаться
              </Link>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[var(--muted)] [text-shadow:0_2px_16px_rgba(0,0,0,0.35)]">
            <div>{user.followerIds.length} подписчиков</div>
            <div>{user.followingIds.length} подписок</div>
            <div>Регистрация: {formatters.fullDate.format(new Date(user.createdAt))}</div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] [text-shadow:0_2px_16px_rgba(0,0,0,0.35)]">{user.bio}</p>
        </div>
      </section>

      <div className="grid w-full grid-cols-2 gap-2 rounded-[24px] bg-[var(--panel-strong)] p-2">
        {tabItems.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={joinClasses(
              "rounded-full px-4 py-3 text-center text-sm font-medium transition",
              activeTab === item.key ? "bg-white/[0.08] text-[var(--text)]" : "text-[var(--muted)]",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {isOwn ? <PostComposer compact /> : null}

      <div className="grid gap-4">
        {contentLocked ? (
          <EmptyState
            title="Приватный профиль"
            description="Посты и лайки этого пользователя видны только его подписчикам."
          />
        ) : currentItems.length ? (
          currentItems.map((post) => <PostCard key={post.id} post={post} viewer={viewer} />)
        ) : (
          <EmptyState
            title={activeTab === "posts" ? "Нет постов" : "Нет лайков"}
            description={
              activeTab === "posts"
                ? "Когда пользователь опубликует записи, они появятся здесь."
                : "Здесь будут собираться понравившиеся посты."
            }
          />
        )}
      </div>
    </div>
  );
}
