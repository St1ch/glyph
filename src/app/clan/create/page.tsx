import Link from "next/link";
import { redirect } from "next/navigation";
import { ClanCreateForm } from "@/components/client";
import { EmptyState, SectionCard } from "@/components/server";
import { getViewer } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ClanCreatePage() {
  const viewer = await getViewer();

  if (!viewer) {
    redirect("/auth/login");
  }

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 min-[2400px]:max-w-[920px]">
      <SectionCard
        title="Создать клан"
        description="Минимальный старт: название, адрес, описание и эмодзи-аватар. После создания вы сразу попадёте на страницу сообщества."
      >
        <ClanCreateForm />
      </SectionCard>

      {!viewer.verifiedEmailAt ? (
        <EmptyState
          title="Сначала подтвердите почту"
          description="После подтверждения почты создание кланов откроется автоматически."
        />
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/search"
          className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:bg-white/[0.04] hover:text-[var(--text)]"
        >
          Вернуться к поиску
        </Link>
      </div>
    </div>
  );
}
