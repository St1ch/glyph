import Link from "next/link";
import { NotificationsReadBridge } from "@/components/client";
import { NotificationList, SectionCard } from "@/components/server";
import { getNotificationsData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const { viewer, items } = await getNotificationsData();

  return (
    <div className="flex w-full max-w-[760px] flex-col gap-6 px-4 py-6">
      {viewer ? <NotificationsReadBridge /> : null}
      <SectionCard
        title="Уведомления"
        description="Лайки, новые подписчики, системные обновления и статусы заявок собираются здесь."
      >
        {viewer ? (
          <NotificationList items={items} />
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--line)] px-5 py-10 text-center">
            <h2 className="text-lg font-semibold">Нужен вход в аккаунт</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              После входа здесь будут уведомления по лайкам, подпискам и заявкам на верификацию.
            </p>
            <div className="mt-4">
              <Link
                href="/auth/login"
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
              >
                Войти
              </Link>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
