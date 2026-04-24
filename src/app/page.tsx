import type { Metadata } from "next";
import Link from "next/link";
import { PostComposer } from "@/components/client";
import { EmptyState, PostCard, SectionCard } from "@/components/server";
import { getAppData } from "@/lib/data";
import { joinClasses } from "@/lib/site";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams: Promise<{ view?: string }>;
};

export async function generateMetadata({
  searchParams,
}: HomeProps): Promise<Metadata> {
  const params = await searchParams;
  const view = params.view ?? "for-you";

  if (view === "clans") {
    return {
      title: "Лента кланов",
      description: "Публикации кланов и тематических сообществ GLYPH в одной ленте.",
      alternates: { canonical: "/" },
    };
  }

  if (view === "following") {
    return {
      title: "Подписки",
      description: "Лента публикаций пользователей, на которых вы подписаны в GLYPH.",
      alternates: { canonical: "/" },
    };
  }

  return {
    title: "Лента",
    description: "Главная лента GLYPH: посты, комментарии, репосты, кланы и уведомления в одной социальной платформе.",
    alternates: { canonical: "/" },
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const view = params.view ?? "for-you";
  const { viewer, feed } = await getAppData();

  const filteredFeed = feed.filter((post) => {
    if (view === "clans") {
      return post.author.type === "group";
    }

    if (view === "following" && viewer) {
      return post.author.type === "user" && viewer.followingIds.includes(post.authorId);
    }

    return true;
  });

  const tabs = [
    { key: "for-you", label: "Для вас", href: "/?view=for-you" },
    { key: "clans", label: "Лента кланов", href: "/?view=clans" },
    { key: "following", label: "Подписки", href: "/?view=following" },
  ] as const;

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[760px] px-4 min-[2400px]:max-w-[980px]">
        <div className="sticky top-16 z-30 mb-6 -mx-2 px-2 pb-3 pt-1 backdrop-blur lg:top-4">
          <div className="flex justify-center rounded-[30px] bg-[color:color-mix(in_srgb,var(--page)_82%,transparent)] py-2">
            <div className="grid w-full max-w-[520px] grid-cols-1 gap-2 rounded-[26px] border border-[var(--line)] bg-[var(--panel-strong)] p-2 shadow-[0_16px_36px_-26px_rgba(0,0,0,0.85)] sm:grid-cols-3 sm:gap-1 sm:rounded-full">
              {tabs.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={joinClasses(
                    "rounded-full px-4 py-3 text-center text-sm font-medium transition",
                    view === tab.key
                      ? "bg-white/[0.08] text-[var(--text)]"
                      : "text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6">
          {viewer ? (
            <PostComposer />
          ) : (
            <SectionCard
              title="Чтобы постить и собирать свой круг"
              description="Авторизуйтесь, и на главной появится быстрый постинг прямо в ленте."
            >
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth/register"
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
                >
                  Создать аккаунт
                </Link>
                <Link
                  href="/auth/login"
                  className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                >
                  Войти
                </Link>
              </div>
            </SectionCard>
          )}
        </div>

        <div className="grid gap-4">
          {filteredFeed.length ? (
            filteredFeed.map((post) => <PostCard key={post.id} post={post} viewer={viewer} />)
          ) : (
            <EmptyState
              title="Пока пусто"
              description="В этом режиме ленты пока нет постов. Переключите вкладку или подпишитесь на людей."
            />
          )}
        </div>
      </div>
    </div>
  );
}
