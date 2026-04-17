import type { Metadata } from "next";
import Image from "next/image";
import { PostComposer } from "@/components/client";
import { AvatarBubble, ClanCard, EmptyState, PostCard, SectionCard } from "@/components/server";
import { getClanData } from "@/lib/data";

export const dynamic = "force-dynamic";

type ClanPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ClanPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getClanData(slug);

  if (!data) {
    return {
      title: "Клан не найден",
      description: "Запрошенный клан в GLYPH не найден.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const { group } = data;

  return {
    title: `${group.name} (@${group.slug})`,
    description: group.description || `Клан ${group.name} в социальной платформе GLYPH.`,
    alternates: {
      canonical: `/clan/${group.slug}`,
    },
  };
}

export default async function ClanPage({ params }: ClanPageProps) {
  const { slug } = await params;
  const data = await getClanData(slug);

  if (!data) {
    return (
      <div className="w-full max-w-[760px] px-4 py-6 min-[2400px]:max-w-[980px]">
        <EmptyState
          title="Клан не найден"
          description="Проверьте адрес или найдите нужное сообщество через поиск."
        />
      </div>
    );
  }

  const { viewer, group, members, posts, viewerGroups } = data;
  const canPost = viewer ? group.memberIds.includes(viewer.id) : false;

  return (
      <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 min-[2400px]:max-w-[980px]">
      <section className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_30px_80px_-55px_rgba(15,23,42,0.45)]">
        <div className="h-44 w-full sm:h-52">
          {group.coverImage ? (
            <Image
              src={group.coverImage}
              alt={group.name}
              width={1600}
              height={420}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_top_left,rgba(132,184,44,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01)),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.34))]" />
          )}
        </div>
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end">
            <AvatarBubble avatar={group.avatar} name={group.name} size="lg" />
            <div className="pb-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.name}</h1>
              <div className="mt-1 text-sm text-[var(--muted)]">@{group.slug}</div>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--muted)]">{group.description}</p>
          <div className="mt-5 text-sm text-[var(--muted)]">{group.memberIds.length} участников</div>
        </div>
      </section>

      {canPost ? <PostComposer compact groups={viewerGroups} initialGroupSlug={group.slug} /> : null}

      <SectionCard title="Посты клана" description="Сюда попадают публикации сообщества и всё, что удерживает общую тему.">
        <div className="grid gap-4">
          {posts.length ? (
            posts.map((post) => <PostCard key={post.id} post={post} viewer={viewer} />)
          ) : (
            <EmptyState
              title="Постов пока нет"
              description="Здесь появятся публикации участников этого клана."
            />
          )}
        </div>
      </SectionCard>

      <SectionCard title="Вступить" description="Присоединяйтесь к клану, чтобы собирать свой круг интересов.">
        <ClanCard group={group} viewer={viewer} />
      </SectionCard>

      <SectionCard title="Участники" description="Внутри можно быстро понять, кто уже состоит в сообществе.">
        <div className="grid gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)] p-3"
            >
              <AvatarBubble avatar={member.avatar} name={member.name} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{member.name}</div>
                <div className="truncate text-xs text-[var(--muted)]">@{member.handle}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
