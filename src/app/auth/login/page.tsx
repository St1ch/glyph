import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/client";

export const metadata: Metadata = {
  title: "Вход",
  description: "Войдите в аккаунт GLYPH по email или username.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/auth/login",
  },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-12">
      <Link href="/" className="flex flex-col items-center gap-2">
        <span className="text-3xl font-semibold tracking-tight">GLYPH</span>
        <span className="text-xs text-[var(--muted)]">v1 beta</span>
      </Link>
      <div className="w-full rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] sm:p-6">
        <AuthForm mode="login" initialError={error ? decodeURIComponent(error) : ""} />
        <div className="mt-5 text-center text-sm text-[var(--muted)]">
          Нет аккаунта?{" "}
          <Link href="/auth/register" className="font-semibold text-[var(--accent)] underline underline-offset-4">
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </div>
  );
}
