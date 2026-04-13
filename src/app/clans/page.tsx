import Link from "next/link";
import { redirect } from "next/navigation";
import { ClanCard, EmptyState, SectionCard } from "@/components/server";
import { getClansDirectoryData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ClansPage() {
  const { viewer, memberGroups, discoverGroups } = await getClansDirectoryData();

  if (!viewer) {
    redirect("/auth/login");
  }

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6">
      <SectionCard
        title="Кланы"
        description="Здесь собраны сообщества, в которых вы уже состоите, и новые кланы, которые можно развивать дальше."
      >
        <div className="flex justify-end">
          <Link
            href="/clan/create"
            className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] transition hover:opacity-90"
          >
            Создать клан
          </Link>
        </div>
      </SectionCard>

      <SectionCard
        title="Ваши кланы"
        description="Быстрый доступ к тем сообществам, где вы уже состоите."
      >
        <div className="grid gap-3">
          {memberGroups.length ? (
            memberGroups.map((group) => <ClanCard key={group.id} group={group} viewer={viewer} />)
          ) : (
            <EmptyState
              title="У вас пока нет кланов"
              description="Создайте первый клан или вступите в существующий, чтобы он появился в этом разделе."
            />
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Открыть ещё"
        description="Новые сообщества, которые можно посмотреть и при желании сразу присоединиться."
      >
        <div className="grid gap-3">
          {discoverGroups.length ? (
            discoverGroups.map((group) => <ClanCard key={group.id} group={group} viewer={viewer} />)
          ) : (
            <EmptyState
              title="Пока без новых кланов"
              description="Сейчас вы уже состоите во всех доступных сообществах."
            />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
