import Link from "next/link";
import { ClanCard, EmptyState, SectionCard, UserCard } from "@/components/server";
import { getSearchData } from "@/lib/data";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q ?? "";
  const { viewer, users, groups } = await getSearchData(query);

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6">
      <SectionCard
        title="Поиск"
        description="Ищите людей по имени и username, а кланы по названию, slug или описанию."
      >
        <form action="/search" className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Например: anya, bloom, дизайн"
            className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 outline-none"
          />
          <button className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90">
            Найти
          </button>
        </form>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Люди"
          description={query ? `Результаты по запросу «${query}».` : "Все профили, доступные сейчас."}
        >
          <div className="grid gap-3">
            {users.length ? (
              users.map((user) => <UserCard key={user.id} user={user} viewer={viewer} />)
            ) : (
              <EmptyState
                title="Людей не найдено"
                description="Попробуйте другой запрос или создайте новый аккаунт, чтобы расширить сеть."
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Кланы"
          description="Сообщества можно использовать для точек сборки вокруг тематики, города или проекта."
        >
          <div className="mb-4 flex justify-end">
            <Link
              href="/clan/create"
              className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] transition hover:opacity-90"
            >
              Создать клан
            </Link>
          </div>
          <div className="grid gap-3">
            {groups.length ? (
              groups.map((group) => <ClanCard key={group.id} group={group} viewer={viewer} />)
            ) : (
              <EmptyState
                title="Кланы не найдены"
                description="На старте можно развивать тематические сообщества и собирать вокруг них подписчиков."
              />
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
