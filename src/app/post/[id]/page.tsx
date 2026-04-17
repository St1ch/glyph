import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard, SectionCard } from "@/components/server";
import { getPostData } from "@/lib/data";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getPostData(id);

  if (!data.post) {
    return {
      title: "Пост не найден",
      description: "Запрошенный пост в GLYPH не найден или недоступен.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const post = data.post;
  const authorName = post.author.name;
  const excerpt = post.content.trim().slice(0, 140);

  return {
    title: `Пост ${authorName}`,
    description: excerpt || `Обсуждение публикации автора ${authorName} в GLYPH.`,
    alternates: {
      canonical: `/post/${post.id}`,
    },
  };
}

export default async function PostDetailPage(props: PageProps<"/post/[id]">) {
  const { id } = await props.params;
  const { viewer, post } = await getPostData(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[760px] px-4 min-[2400px]:max-w-[980px]">
        <SectionCard
          title="Обсуждение поста"
          description="Здесь собраны все комментарии и ответы к публикации."
        >
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            >
              ← Назад в ленту
            </Link>
          </div>
          <PostCard post={post} viewer={viewer} showComments />
        </SectionCard>
      </div>
    </div>
  );
}
