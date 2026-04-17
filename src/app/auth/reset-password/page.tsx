import type { Metadata } from "next";
import Link from "next/link";
import { PasswordResetForm } from "@/components/client";

export const metadata: Metadata = {
  title: "Смена пароля",
  description: "Задайте новый пароль для аккаунта GLYPH по ссылке из письма.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/auth/reset-password",
  },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-12">
      <Link href="/" className="flex flex-col items-center gap-2">
        <span className="text-3xl font-semibold tracking-tight">GLYPH</span>
        <span className="text-xs text-[var(--muted)]">v1 beta</span>
      </Link>
      <div className="w-full rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] sm:p-6">
        <div className="grid gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Смена пароля</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">Введите новый пароль для аккаунта.</p>
          </div>

          {token ? (
            <PasswordResetForm token={token} />
          ) : (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              Ссылка смены пароля не содержит токен.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
