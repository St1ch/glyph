import Link from "next/link";
import { SectionCard } from "@/components/server";
import { verifyEmail } from "@/lib/data";

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  let state: "success" | "error" = "success";
  let message = "Почта подтверждена. Теперь можно войти в аккаунт.";

  if (!token) {
    state = "error";
    message = "Ссылка подтверждения не содержит токен.";
  } else {
    try {
      await verifyEmail(token);
    } catch (error) {
      state = "error";
      message = error instanceof Error ? error.message : "Не удалось подтвердить почту.";
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <SectionCard
        title={state === "success" ? "Почта подтверждена" : "Ошибка подтверждения"}
        description="Подтверждение email обязательно перед входом в аккаунт."
      >
        <div
          className={`rounded-[24px] border px-5 py-5 text-sm leading-7 ${
            state === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300"
          }`}
        >
          {message}
        </div>
        <div className="mt-5">
          <Link
            href="/auth/login"
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90"
          >
            Перейти ко входу
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
