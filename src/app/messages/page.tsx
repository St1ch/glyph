import Link from "next/link";
import { SectionCard } from "@/components/server";

export default function MessagesPage() {
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6">
      <SectionCard
        title="Личные сообщения скоро"
        description="Раздел уже зарезервирован, но сами сообщения пока ещё не вошли в текущий релиз."
      >
        <div className="rounded-[28px] border border-dashed border-[var(--line)] px-6 py-12 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Этот раздел появится позже</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            Сейчас здесь заглушка под будущие личные сообщения. Архитектура проекта уже разложена так,
            чтобы позже добавить диалоги, списки чатов, индикаторы прочтения и вложения без пересборки
            всего интерфейса.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
            >
              Вернуться в ленту
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
