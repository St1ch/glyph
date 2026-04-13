import Link from "next/link";
import { AuthForm } from "@/components/client";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-12">
      <Link href="/" className="flex flex-col items-center gap-2">
        <span className="text-3xl font-semibold tracking-tight">GLYPH</span>
        <span className="text-xs text-[var(--muted)]">v1 beta</span>
      </Link>
      <div className="w-full rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] sm:p-6">
        <AuthForm mode="register" />
        <div className="mt-5 text-center text-sm text-[var(--muted)]">
          Уже есть аккаунт?{" "}
          <Link href="/auth/login" className="font-semibold text-[var(--accent)] underline underline-offset-4">
            Войти
          </Link>
        </div>
      </div>
    </div>
  );
}
