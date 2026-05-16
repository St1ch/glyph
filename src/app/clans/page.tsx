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
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 min-[2400px]:max-w-[980px]">
      <SectionCard
        title="Кланы"
        description="Ваши сообщества и новые кланы собраны в одном месте, чтобы не приходилось прыгать между одинаковыми блоками."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Создать своё сообщество</div>
            <p className="mt-1 text-sm text-[var(--muted)]">Подходит для темы, проекта, города или команды.</p>
          </div>
          <Link
            href="/clan/create"
            className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] transition hover:opacity-90"
          >
            Создать клан
          </Link>
        </div>

        <div className="mt-6 grid gap-6">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Ваши кланы</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Быстрый доступ к сообществам, где вы уже состоите.</p>
              </div>
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {memberGroups.length}
              </span>
            </div>
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
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Открыть ещё</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Новые сообщества, которые можно посмотреть и сразу присоединиться.</p>
              </div>
              <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">
                {discoverGroups.length}
              </span>
            </div>
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
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
