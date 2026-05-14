import type { Metadata } from "next";
import Link from "next/link";
import { MessagesPanel } from "@/components/client";
import { EmptyState, SectionCard } from "@/components/server";
import { getMessagesData } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Сообщения",
  description: "Личные сообщения пользователей GLYPH.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/messages",
  },
};

type MessagesPageProps = {
  searchParams: Promise<{
    conversation?: string;
    q?: string;
  }>;
};

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const params = await searchParams;
  const data = await getMessagesData(params.conversation ?? "", params.q ?? "");

  if (!data.viewer) {
    return (
      <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 min-[2400px]:max-w-[980px]">
        <SectionCard
          title="Личные сообщения"
          description="Диалоги доступны только после входа в аккаунт."
        >
          <div className="grid gap-4">
            <EmptyState
              title="Нужно войти"
              description="Авторизуйтесь, чтобы писать другим пользователям и видеть свои диалоги."
            />
            <Link
              href="/auth/login"
              className="justify-self-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
            >
              Войти
            </Link>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="messages-page h-full w-full px-3 py-3 lg:px-0 lg:py-0">
      <MessagesPanel
        viewerId={data.viewer.id}
        conversations={data.conversations}
        messages={data.messages}
        activeConversation={data.activeConversation}
        candidates={data.candidates}
        search={data.search}
      />
    </div>
  );
}
