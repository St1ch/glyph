import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminDeletePostButton,
  ReportReviewButtons,
  RevokeVerificationButton,
  VerificationReviewButtons,
} from "@/components/client";
import { AvatarBubble, EmptyState, PostCard, SectionCard, VerificationBadge } from "@/components/server";
import { getAdminData } from "@/lib/data";
import { formatRelativeDate } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Админка",
  description: "Служебный раздел модерации GLYPH для работы с жалобами, заявками и проверками.",
  alternates: {
    canonical: "/admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

function formatReportCategory(category: string) {
  switch (category) {
    case "spam":
      return "Спам";
    case "abuse":
      return "Оскорбления";
    case "adult":
      return "18+ контент";
    case "violence":
      return "Насилие";
    case "misinformation":
      return "Дезинформация";
    default:
      return "Другое";
  }
}

type AdminPageProps = {
  searchParams: Promise<{ post?: string }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const query = await searchParams;
  let data;

  try {
    data = await getAdminData(query.post ?? "");
  } catch {
    notFound();
  }

  const { viewer, requests, reports, posts, postSearch } = data;
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const historyRequests = requests.filter((request) => request.status !== "pending");

  return (
    <div className="flex w-full max-w-[860px] flex-col gap-6 px-4 py-6 min-[2400px]:max-w-[1100px]">
      <SectionCard
        title="Жалобы на посты"
        description="Все жалобы из меню постов попадают сюда. Можно принять жалобу или отклонить её."
      >
        {reports.length ? (
          <div className="grid gap-4">
            {reports.map((report) => (
              <article key={report.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <Link href={`/profile/${report.reporter.handle}`} className="shrink-0">
                          <AvatarBubble avatar={report.reporter.avatar} name={report.reporter.name} />
                        </Link>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/profile/${report.reporter.handle}`} className="text-base font-semibold tracking-tight hover:opacity-75">
                              {report.reporter.name}
                            </Link>
                            <span className="text-sm text-[var(--muted)]">@{report.reporter.handle}</span>
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Жалоба отправлена {formatRelativeDate(report.createdAt)}
                            {report.reviewedAt ? ` · обработана ${formatRelativeDate(report.reviewedAt)}` : ""}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Категория</div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text)]">{formatReportCategory(report.category)}</p>
                        </div>
                        {report.details ? (
                          <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Комментарий</div>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{report.details}</p>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <ReportReviewButtons reportId={report.id} status={report.status} />
                  </div>

                  {report.post ? (
                    <PostCard post={report.post} viewer={viewer} />
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-[var(--line)] px-4 py-6 text-sm text-[var(--muted)]">
                      Пост уже удалён или недоступен, но жалоба сохранена в истории.
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Жалоб пока нет"
            description="Когда пользователи начнут жаловаться на посты, они появятся здесь."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Активные заявки на верификацию"
        description="Новые видео и описания на проверке. Отсюда можно одобрить или отклонить заявку."
      >
        {pendingRequests.length ? (
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <article key={request.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${request.user.handle}`} className="shrink-0">
                        <AvatarBubble avatar={request.user.avatar} name={request.user.name} />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/profile/${request.user.handle}`} className="text-base font-semibold tracking-tight hover:opacity-75">
                            {request.user.name}
                          </Link>
                          <span className="text-sm text-[var(--muted)]">@{request.user.handle}</span>
                          <VerificationBadge status={request.user.verificationStatus} />
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Отправлено {formatRelativeDate(request.submittedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Причина</div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{request.reason}</p>
                    </div>

                    <div className="mt-3">
                      <a
                        href={request.videoPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                      >
                        Открыть видео
                      </a>
                    </div>
                  </div>

                  <VerificationReviewButtons requestId={request.id} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Нет активных заявок"
            description="Сейчас все новые запросы на верификацию уже разобраны."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Логи верификации"
        description="История одобренных и отклонённых заявок хранится здесь. При необходимости верификацию можно отозвать."
      >
        {historyRequests.length ? (
          <div className="grid gap-4">
            {historyRequests.map((request) => (
              <article key={request.id} className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${request.user.handle}`} className="shrink-0">
                        <AvatarBubble avatar={request.user.avatar} name={request.user.name} />
                      </Link>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/profile/${request.user.handle}`} className="text-base font-semibold tracking-tight hover:opacity-75">
                            {request.user.name}
                          </Link>
                          <span className="text-sm text-[var(--muted)]">@{request.user.handle}</span>
                          <VerificationBadge status={request.user.verificationStatus} />
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              request.status === "approved"
                                ? "bg-emerald-500/12 text-emerald-300"
                                : "bg-rose-500/12 text-rose-300"
                            }`}
                          >
                            {request.status === "approved" ? "Одобрено" : "Отклонено"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Обработано после заявки от {formatRelativeDate(request.submittedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Архив причины</div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{request.reason}</p>
                    </div>
                  </div>

                  <RevokeVerificationButton
                    userId={request.user.id}
                    disabled={request.user.verificationStatus !== "approved"}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="История пока пустая"
            description="После первых решений по заявкам здесь появится журнал проверок."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Посты в ленте"
        description="Быстрая ручная модерация контента. Можно найти пост по ID, тексту или автору."
      >
        <form className="mb-4" action="/admin">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              name="post"
              defaultValue={postSearch}
              placeholder="Поиск по ID, тексту поста или автору"
              className="w-full rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--text)] outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
            >
              Найти
            </button>
          </div>
        </form>

        {posts.length ? (
          <div className="grid gap-4">
            {posts.map((post) => (
              <div key={post.id} className="grid gap-3">
                <div className="flex justify-end">
                  <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">
                    Жалоб: {post.reportCount}
                  </div>
                </div>
                <PostCard post={post} viewer={viewer} />
                <div className="flex justify-end">
                  <AdminDeletePostButton postId={post.id} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Посты не найдены"
            description="По этому запросу ничего не нашлось. Попробуйте часть текста, ID поста или handle автора."
          />
        )}
      </SectionCard>
    </div>
  );
}
