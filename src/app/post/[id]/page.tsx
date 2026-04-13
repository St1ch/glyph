import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard, SectionCard } from "@/components/server";
import { getPostData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PostDetailPage(props: PageProps<"/post/[id]">) {
  const { id } = await props.params;
  const { viewer, post } = await getPostData(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[760px] px-4">
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
