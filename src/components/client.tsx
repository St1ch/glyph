"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { AdminPostReport, DecoratedPost, DecoratedPostComment, ThemePreference, User, VerificationStatus } from "@/lib/types";
import { formatRelativeDate, imageTypes, joinClasses, uploadLimits, verificationVideoTypes } from "@/lib/site";
import { EmojiPicker } from "@/components/emoji-picker";
export { MobileNavBar } from "@/components/mobile-nav-bar";

type RequestError = {
  error?: string;
  message?: string;
  verificationLink?: string;
};

type LiveNotificationItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  createdAt: string;
};

type RealtimeIncomingEvent =
  | {
      type: "socket:ready";
      payload: {
        userId: string;
      };
    }
  | {
      type: "notification:new";
      payload: {
        item: LiveNotificationItem;
      };
    }
  | {
      type: "feed:changed";
      payload: {
        reason: string;
        postId?: string;
        actorId?: string;
      };
    }
  | {
      type: "profile:changed";
      payload: {
        userId: string;
      };
    };

function getUploadLimitText(kind: "avatar" | "cover" | "post" | "verification") {
  const maxMb = Math.round(uploadLimits[kind] / (1024 * 1024));

  if (kind === "verification") {
    return `Максимальный размер видео — ${maxMb} МБ. Поддерживаются форматы: ${verificationVideoTypes.join(", ")}.`;
  }

  if (kind === "avatar") {
    return `Максимальный размер изображения для аватара — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP и GIF.`;
  }

  if (kind === "cover") {
    return `Максимальный размер изображения для обложки — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP и GIF.`;
  }

  return `Максимальный размер изображения — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP и GIF.`;
}

async function uploadFile(file: File, kind: "avatar" | "cover" | "post" | "verification") {
  if (kind === "verification") {
    if (!verificationVideoTypes.includes(file.type as (typeof verificationVideoTypes)[number])) {
      throw new Error("Поддерживаются только видео MP4, WebM или MOV.");
    }
  } else if (!imageTypes.includes(file.type as (typeof imageTypes)[number])) {
    throw new Error("Поддерживаются только изображения JPG, PNG, WEBP и GIF.");
  }

  if (file.size > uploadLimits[kind]) {
    throw new Error(getUploadLimitText(kind));
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("kind", kind);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const raw = await response.text();
  let data: { path?: string; error?: string } | null = null;

  if (raw) {
    try {
      data = JSON.parse(raw) as { path?: string; error?: string };
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 413) {
      if (file.size > uploadLimits[kind]) {
        throw new Error(getUploadLimitText(kind));
      }

      throw new Error("Файл подходит по формату и размеру для приложения, но сервер отклонил загрузку из-за своего лимита. Нужно увеличить лимит загрузки на сервере.");
    }

    throw new Error(data?.error || "Не удалось загрузить файл. Проверьте формат и размер файла.");
  }

  if (!data?.path) {
    throw new Error("Сервер вернул некорректный ответ при загрузке файла.");
  }

  return data.path;
}

async function requestJson<T>(
  url: string,
  body: Record<string, unknown>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
      body: JSON.stringify(body),
      ...init,
    });

    const raw = await response.text();
    let data: (T & RequestError) | null = null;

    if (raw) {
      try {
        data = JSON.parse(raw) as T & RequestError;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      if (response.status === 504) {
        throw new Error("Сервер слишком долго отвечает. Проверьте SMTP на сервере и попробуйте снова.");
      }

      throw new Error(data?.error || data?.message || "Что-то пошло не так.");
    }

    if (!data) {
      throw new Error("Сервер вернул некорректный ответ.");
    }

    return data;
  }

function applyTheme(theme: ThemePreference) {
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  document.documentElement.dataset.theme = resolved;
  window.localStorage.setItem("glyph-theme", theme);
}

const fieldClass =
  "w-full rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--text)] outline-none";

const toggleBase =
  "rounded-full px-4 py-3 text-sm font-medium transition";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    return (window.localStorage.getItem("glyph-theme") as ThemePreference | null) || "system";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const items: Array<{ value: ThemePreference; label: string }> = [
    { value: "dark", label: "Тёмная" },
    { value: "light", label: "Светлая" },
    { value: "system", label: "Система" },
  ];

  return (
    <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel-soft)] p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => {
            setTheme(item.value);
            applyTheme(item.value);
          }}
          className={joinClasses(
            "rounded-full px-3 py-1.5 text-[11px] font-medium transition",
            theme === item.value ? "bg-[var(--accent)] text-[var(--page)]" : "text-[var(--muted)]",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function CookieNotice() {
  const visible = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("glyph:cookie-consent", onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener("glyph:cookie-consent", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => window.localStorage.getItem("glyph-cookie-consent") !== "accepted",
    () => false,
  );

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-6 z-[88] hidden w-[340px] rounded-[24px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black_4%)] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)] lg:block">
      <div className="text-sm font-semibold text-[var(--text)]">Файлы cookie</div>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Сайт использует cookie для входа в аккаунт, сохранения сессии, темы оформления и стабильной работы realtime-функций.
      </p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            window.localStorage.setItem("glyph-cookie-consent", "accepted");
            window.dispatchEvent(new Event("glyph:cookie-consent"));
          }}
          className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] hover:opacity-90"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

function NavGlyph({ icon }: { icon: "feed" | "search" | "bell" | "message" | "profile" | "group" }) {
  const common = "h-4 w-4 shrink-0";

  if (icon === "feed") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <rect x="2.5" y="3" width="11" height="2.25" rx="1.125" fill="currentColor" />
        <rect x="2.5" y="6.875" width="11" height="2.25" rx="1.125" fill="currentColor" opacity="0.78" />
        <rect x="2.5" y="10.75" width="7.5" height="2.25" rx="1.125" fill="currentColor" opacity="0.58" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <circle cx="7" cy="7" r="3.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.25 10.25L13.25 13.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "bell") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <path
          d="M8 2.5C6.2 2.5 4.75 3.95 4.75 5.75V7.24C4.75 7.84 4.55 8.42 4.18 8.89L3.35 9.93C2.72 10.72 3.28 11.9 4.29 11.9H11.71C12.72 11.9 13.28 10.72 12.65 9.93L11.82 8.89C11.45 8.42 11.25 7.84 11.25 7.24V5.75C11.25 3.95 9.8 2.5 8 2.5Z"
          fill="currentColor"
        />
        <path d="M6.35 12.35C6.65 13.05 7.26 13.5 8 13.5C8.74 13.5 9.35 13.05 9.65 12.35" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "message") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <path
          d="M3 4.75C3 3.78 3.78 3 4.75 3H11.25C12.22 3 13 3.78 13 4.75V8.85C13 9.82 12.22 10.6 11.25 10.6H7.35L4.55 12.8V10.6H4.75C3.78 10.6 3 9.82 3 8.85V4.75Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (icon === "group") {
    return (
      <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
        <circle cx="5.1" cy="5.4" r="1.9" fill="currentColor" opacity="0.78" />
        <circle cx="10.9" cy="5.4" r="1.9" fill="currentColor" />
        <path d="M2.9 12.9C2.9 11.2 4.22 9.9 5.85 9.9H6.35C7.98 9.9 9.3 11.2 9.3 12.9V13H2.9V12.9Z" fill="currentColor" opacity="0.78" />
        <path d="M6.7 12.9C6.7 11.07 8.1 9.65 9.85 9.65H11.15C12.9 9.65 14.3 11.07 14.3 12.9V13H6.7V12.9Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" fill="none" className={common} aria-hidden="true">
      <circle cx="8" cy="5.4" r="2.4" fill="currentColor" />
      <path d="M3.75 12.9C3.75 10.91 5.46 9.3 7.58 9.3H8.42C10.54 9.3 12.25 10.91 12.25 12.9V13H3.75V12.9Z" fill="currentColor" />
    </svg>
  );
}

function formatNotificationBadge(count: number) {
  return count > 99 ? "99+" : String(count);
}

function useUnreadNotificationCount({
  enabled,
  initialCount,
}: {
  enabled: boolean;
  initialCount: number;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const visibleCount = pathname.startsWith("/notifications") ? 0 : count;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const onNotification = () => {
      if (!pathname.startsWith("/notifications")) {
        setCount((current) => current + 1);
      }
    };
    const onCleared = () => setCount(0);

    window.addEventListener("glyph:notifications-changed", onNotification);
    window.addEventListener("glyph:notifications-cleared", onCleared);

    return () => {
      window.removeEventListener("glyph:notifications-changed", onNotification);
      window.removeEventListener("glyph:notifications-cleared", onCleared);
    };
  }, [enabled, pathname]);

  return visibleCount;
}

export function NavLink({
  href,
  label,
  icon,
  viewerId,
  initialNotificationCount = 0,
}: {
  href: string;
  label: string;
  icon: "feed" | "search" | "bell" | "message" | "profile" | "group";
  viewerId?: string;
  initialNotificationCount?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  const unreadCount = useUnreadNotificationCount({
    enabled: href === "/notifications" && Boolean(viewerId),
    initialCount: initialNotificationCount,
  });

  return (
    <Link
      href={href}
      className={joinClasses(
        "flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-medium transition",
        active
          ? "bg-[var(--panel-strong)] text-[var(--text)] shadow-[0_10px_30px_-22px_rgba(0,0,0,0.8)]"
          : "text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]",
      )}
    >
      <div className="relative shrink-0">
        <NavGlyph icon={icon} />
        {href === "/notifications" && unreadCount > 0 ? (
          <span className="absolute -right-2.5 -top-2.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--page)] shadow-[0_10px_24px_-12px_rgba(132,184,44,0.9)]">
            {formatNotificationBadge(unreadCount)}
          </span>
        ) : null}
      </div>
      <span className="min-w-0">{label}</span>
    </Link>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        })
      }
      className="flex items-center justify-center rounded-[18px] border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)] disabled:opacity-50"
    >
      {pending ? "Выходим..." : "Выйти"}
    </button>
  );
}

function ActionButton({
  label,
  activeLabel,
  endpoint,
  payload,
  active,
  disabled,
}: {
  label: string;
  activeLabel: string;
  endpoint: string;
  payload: Record<string, unknown>;
  active: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await requestJson(endpoint, payload);
            router.refresh();
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Не удалось выполнить действие.");
          }
        })
      }
      className={joinClasses(
        "rounded-full px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border border-[var(--line)] bg-transparent text-[var(--text)] hover:bg-white/[0.04]"
          : "bg-[var(--accent)] text-[var(--page)] hover:opacity-90",
      )}
    >
      {pending ? "..." : active ? activeLabel : label}
    </button>
  );
}

export function FollowButton({ handle, isFollowing, disabled }: { handle: string; isFollowing: boolean; disabled?: boolean }) {
  return <ActionButton label="Подписаться" activeLabel="Вы подписаны" endpoint="/api/follow" payload={{ handle }} active={isFollowing} disabled={disabled} />;
}

export function JoinClanButton({ slug, joined, disabled }: { slug: string; joined: boolean; disabled?: boolean }) {
  return <ActionButton label="Вступить" activeLabel="Вы в клане" endpoint="/api/clans/join" payload={{ slug }} active={joined} disabled={disabled} />;
}

export function LikeButton({ postId, liked, likeCount, disabled }: { postId: string; liked: boolean; likeCount: number; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await requestJson("/api/posts/like", { postId });
            router.refresh();
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Не удалось поставить лайк.");
          }
        })
      }
      className={joinClasses(
        "w-full rounded-full px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 sm:w-auto",
        liked ? "bg-rose-500/14 text-rose-300" : "bg-white/[0.04] text-[var(--muted)] hover:bg-white/[0.06] hover:text-[var(--text)]",
      )}
    >
      {pending ? "..." : liked ? `♥ ${likeCount}` : `♡ ${likeCount}`}
    </button>
  );
}

export function PostOpenFrame({
  href,
  disabled,
  className,
  children,
}: {
  href: string;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const openPost = () => {
    if (!disabled) {
      router.push(href);
    }
  };

  const shouldIgnore = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    Boolean(target.closest("a, button, input, textarea, label, select, [data-no-post-open='true']"));

  return (
    <div
      role={disabled ? undefined : "link"}
      tabIndex={disabled ? undefined : 0}
      onClick={(event) => {
        if (shouldIgnore(event.target)) {
          return;
        }

        openPost();
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPost();
        }
      }}
      className={joinClasses(disabled ? "" : "cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

export function PostImageViewer({
  src,
  alt,
  className,
  width = 1200,
  height = 900,
  maxPreviewHeightClass,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  maxPreviewHeightClass?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-no-post-open="true"
        onClick={() => setIsOpen(true)}
        className={joinClasses("block w-full overflow-hidden rounded-[22px]", className)}
      >
        <Image
          alt={alt}
          src={src}
          width={width}
          height={height}
          className={joinClasses("w-full border border-[var(--line)] object-cover", maxPreviewHeightClass ?? "max-h-[480px]")}
        />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Просмотр изображения">
        <div className="grid gap-4" data-no-post-open="true">
          <Image
            alt={alt}
            src={src}
            width={1600}
            height={1200}
            className="max-h-[75vh] w-full rounded-[22px] object-contain"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            >
              Закрыть
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function PostActionsMenu({
  postId,
  disabledReport,
}: {
  postId: string;
  disabledReport?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const reportCategories = [
    { value: "spam", label: "Спам" },
    { value: "abuse", label: "Оскорбления" },
    { value: "adult", label: "18+ контент" },
    { value: "violence", label: "Насилие" },
    { value: "misinformation", label: "Дезинформация" },
    { value: "other", label: "Другое" },
  ] as const;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  const postUrl =
    typeof window === "undefined"
      ? `/post/${postId}`
      : `${window.location.origin}/post/${postId}`;

  const copyPostLink = async () => {
    try {
      await navigator.clipboard.writeText(postUrl);
      setCopied(true);
      setIsOpen(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.alert("Не удалось скопировать ссылку.");
    }
  };

  return (
    <>
      <div ref={menuRef} className="relative" data-no-post-open="true">
        <button
          type="button"
          aria-label="Меню поста"
          onClick={() => setIsOpen((value) => !value)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
        >
          •••
        </button>

        {isOpen ? (
          <div className="absolute right-0 top-10 z-20 grid min-w-[220px] gap-1 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-2 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
            <button
              type="button"
              onClick={copyPostLink}
              className="rounded-[14px] px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-white/[0.04]"
            >
              {copied ? "Ссылка скопирована" : "Скопировать ссылку"}
            </button>
            <button
              type="button"
              disabled={disabledReport}
              onClick={() => {
                setIsOpen(false);
                setIsReportOpen(true);
              }}
              className="rounded-[14px] px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {disabledReport ? "Войдите, чтобы пожаловаться" : "Пожаловаться"}
            </button>
          </div>
        ) : null}
      </div>

      <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} title="Пожаловаться на пост">
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const formData = new FormData(event.currentTarget);

            try {
              await requestJson("/api/posts/report", {
                postId,
                category: String(formData.get("category") || "other"),
                details: String(formData.get("details") || ""),
              });
              setIsReportOpen(false);
            } catch (value) {
              setError(value instanceof Error ? value.message : "Не удалось отправить жалобу.");
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset className="grid gap-2 text-sm">
            <legend className="text-[var(--muted)]">Выберите категорию жалобы</legend>
            <div className="grid gap-2">
              {reportCategories.map((category, index) => (
                <label
                  key={category.value}
                  className="flex cursor-pointer items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm hover:bg-white/[0.04]"
                >
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    defaultChecked={index === 0}
                  />
                  <span>{category.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Комментарий к жалобе</span>
            <textarea
              name="details"
              rows={4}
              maxLength={500}
              placeholder="Опишите детали, если это поможет модерации"
              className={`${fieldClass} resize-none`}
            />
          </label>

          {error ? (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Отправляем..." : "Отправить жалобу"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

const quickCommentEmojis = ["🔥", "😂", "😭", "👏", "❤️", "✨", "👀", "😎"];

type CommentComposerProps = {
  postId: string;
  disabled?: boolean;
  parentCommentId?: string | null;
  replyLabel?: string;
  compact?: boolean;
  onCancel?: () => void;
};

export function CommentComposer({
  postId,
  disabled,
  parentCommentId = null,
  replyLabel,
  compact = false,
  onCancel,
}: CommentComposerProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  return (
    <form
      className="grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (disabled) return;

        setPending(true);
        setError("");
        const form = event.currentTarget;

        try {
          const imagePath = imageFile ? await uploadFile(imageFile, "post") : "";
          await requestJson("/api/posts/comment", {
            postId,
            content,
            imagePath,
            parentCommentId,
          });
          form.reset();
          setContent("");
          setImageFile(null);
          onCancel?.();
          window.dispatchEvent(new Event("feed:changed"));
          router.refresh();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось отправить комментарий.");
        } finally {
          setPending(false);
        }
      }}
    >
      {replyLabel ? (
        <div className="text-xs text-[var(--muted)]">
          Ответ для <span className="font-medium text-[var(--text)]">{replyLabel}</span>
        </div>
      ) : null}

      <div className="grid gap-2">
        <label className="min-w-0">
          <span className="sr-only">Комментарий</span>
          <textarea
            name="content"
            rows={compact ? 2 : 3}
            maxLength={1000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={disabled ? "Войдите, чтобы комментировать" : "Написать комментарий"}
            disabled={disabled || pending}
            className={joinClasses(
              fieldClass,
              compact ? "min-h-[72px]" : "min-h-[84px]",
              "resize-none disabled:opacity-60",
            )}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          {quickCommentEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              disabled={disabled || pending}
              onClick={() => setContent((current) => `${current}${emoji}`)}
              className="rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-1.5 text-sm transition hover:bg-white/[0.04] disabled:opacity-50"
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs hover:bg-white/[0.04]">
              <span>🖼</span>
              <span>{imageFile ? imageFile.name : "Картинка"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            {imageFile ? (
              <button
                type="button"
                onClick={() => setImageFile(null)}
                className="rounded-full border border-[var(--line)] px-3 py-2 text-xs hover:bg-white/[0.04]"
              >
                Убрать файл
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
              >
                Отмена
              </button>
            ) : null}
            <button
              type="submit"
              disabled={disabled || pending}
              className="rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "..." : parentCommentId ? "Ответить" : "Комментировать"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
    </form>
  );
}

function CommentAvatar({ user }: { user: DecoratedPostComment["author"] }) {
  if (user.avatar.type === "image") {
    return (
      <Image
        alt={user.name}
        src={user.avatar.value}
        width={40}
        height={40}
        className="h-10 w-10 rounded-full border border-[var(--line)] object-cover"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] text-lg">
      {user.avatar.value}
    </div>
  );
}

function CommentNode({
  comment,
  childrenMap,
  disabled,
  replyingToId,
  setReplyingToId,
  postId,
  commentLookup,
}: {
  comment: DecoratedPostComment;
  childrenMap: Map<string, DecoratedPostComment[]>;
  disabled?: boolean;
  replyingToId: string | null;
  setReplyingToId: (value: string | null) => void;
  postId: string;
  commentLookup: Map<string, DecoratedPostComment>;
}) {
  const replies = childrenMap.get(comment.id) ?? [];
  const parent = comment.parentCommentId ? commentLookup.get(comment.parentCommentId) : null;
  const isReplying = replyingToId === comment.id;

  return (
    <div className={joinClasses("grid gap-3", comment.parentCommentId ? "ml-6 border-l border-[var(--line)] pl-4" : "")}>
      <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel-soft)] p-3">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${comment.author.handle}`} className="shrink-0">
            <CommentAvatar user={comment.author} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/profile/${comment.author.handle}`} className="text-sm font-semibold tracking-tight hover:opacity-75">
                {comment.author.name}
              </Link>
              <span className="text-xs text-[var(--muted)]">@{comment.author.handle}</span>
              {comment.author.verificationStatus === "approved" ? (
                <span className="rounded-full bg-[#0f3b6c] px-2 py-0.5 text-[10px] font-semibold text-[#90c8ff]">Вериф.</span>
              ) : null}
              <span className="text-xs text-[var(--muted)]">{formatRelativeDate(comment.createdAt)}</span>
            </div>
            {parent ? (
              <div className="mt-2 text-xs text-[var(--muted)]">
                Ответ для <span className="font-medium text-[var(--text)]">@{parent.author.handle}</span>
              </div>
            ) : null}
            {comment.content ? (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{comment.content}</p>
            ) : null}
            {comment.imagePath ? (
              <PostImageViewer
                src={comment.imagePath}
                alt="Изображение в комментарии"
                width={960}
                height={720}
                className="mt-3 rounded-[16px]"
                maxPreviewHeightClass="max-h-[280px]"
              />
            ) : null}
            <div className="mt-3">
              <button
                type="button"
                disabled={disabled}
                onClick={() => setReplyingToId(isReplying ? null : comment.id)}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:opacity-50"
              >
                {isReplying ? "Закрыть ответ" : "Ответить"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isReplying ? (
        <div className="ml-6">
          <CommentComposer
            postId={postId}
            disabled={disabled}
            compact
            parentCommentId={comment.id}
            replyLabel={`@${comment.author.handle}`}
            onCancel={() => setReplyingToId(null)}
          />
        </div>
      ) : null}

      {replies.length ? (
        <div className="grid gap-3">
          {replies.map((reply) => (
            <CommentNode
              key={reply.id}
              comment={reply}
              childrenMap={childrenMap}
              disabled={disabled}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              postId={postId}
              commentLookup={commentLookup}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CommentsPanel({
  postId,
  comments,
  disabled,
}: {
  postId: string;
  comments: DecoratedPostComment[];
  disabled?: boolean;
}) {
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const childrenMap = useMemo(() => {
    const map = new Map<string, DecoratedPostComment[]>();

    for (const comment of comments) {
      if (!comment.parentCommentId) {
        continue;
      }

      map.set(comment.parentCommentId, [...(map.get(comment.parentCommentId) ?? []), comment]);
    }

    return map;
  }, [comments]);

  const commentLookup = useMemo(() => new Map(comments.map((comment) => [comment.id, comment])), [comments]);
  const rootComments = useMemo(() => comments.filter((comment) => !comment.parentCommentId), [comments]);

  return (
    <div className="grid gap-3">
      {rootComments.length ? (
        <div className="grid gap-3">
          {rootComments.map((comment) => (
            <CommentNode
              key={comment.id}
              comment={comment}
              childrenMap={childrenMap}
              disabled={disabled}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              postId={postId}
              commentLookup={commentLookup}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-[var(--muted)]">Пока без комментариев. Можно начать обсуждение первым.</div>
      )}

      <CommentComposer postId={postId} disabled={disabled} />
    </div>
  );
}

export function RepostButton({
  post,
  disabled,
}: {
  post: DecoratedPost;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="w-full rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        ↻ Репост
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Репост поста">
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const form = event.currentTarget;
            const formData = new FormData(form);

            try {
              await requestJson("/api/posts", {
                content: String(formData.get("content") || ""),
                imagePath: "",
                pollQuestion: "",
                pollOptions: [],
                repostOfPostId: post.id,
              });
              form.reset();
              setIsOpen(false);
              window.dispatchEvent(new Event("feed:changed"));
              router.refresh();
            } catch (value) {
              setError(value instanceof Error ? value.message : "Не удалось сделать репост.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">{post.author.name}</div>
            <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">
              {post.content || "Репост без текста"}
            </div>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Ваш комментарий</span>
            <textarea
              name="content"
              rows={4}
              placeholder="Добавьте мысль к репосту"
              className={`${fieldClass} resize-none`}
            />
          </label>

          {error ? (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Публикуем..." : "Сделать репост"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function VoteButtons({ post, disabled }: { post: DecoratedPost; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!post.poll) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {post.poll.options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled || pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await requestJson("/api/posts/vote", { postId: post.id, optionId: option.id });
                router.refresh();
              } catch (error) {
                window.alert(error instanceof Error ? error.message : "Не удалось отправить голос.");
              }
            })
          }
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:opacity-50"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AuthForm({
  mode,
  initialError = "",
}: {
  mode: "login" | "register";
  initialError?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [previewLink, setPreviewLink] = useState("");

  const title = mode === "login" ? "Вход в GLYPH" : "Регистрация в GLYPH";

  return (
    <form
      action={mode === "login" ? "/auth/login/submit" : undefined}
      method={mode === "login" ? "post" : undefined}
      className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setSuccess("");
          setPreviewLink("");

          const form = event.currentTarget;
          const formData = new FormData(form);
          const payload =
            mode === "login"
              ? {
                  login: formData.get("login"),
                  password: formData.get("password"),
              }
            : {
                name: formData.get("name"),
                handle: formData.get("handle"),
                email: formData.get("email"),
                password: formData.get("password"),
              };

        try {
          const response = await requestJson<{ message?: string; verificationLink?: string }>(`/api/auth/${mode}`, payload);

          if (mode === "login") {
            router.push("/");
            router.refresh();
            return;
            }

            setSuccess(response.message || "Аккаунт создан. Подтвердите почту, затем войдите.");
            setPreviewLink(response.verificationLink || "");
            form.reset();
          } catch (value) {
            setError(value instanceof Error ? value.message : "Не удалось отправить форму.");
          } finally {
            setPending(false);
          }
      }}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {mode === "login" ? "Вход работает по email или username." : "После регистрации почту нужно подтвердить по ссылке."}
        </p>
      </div>

      {mode === "register" ? (
        <>
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Имя</span>
            <input name="name" required minLength={2} placeholder="Ваше имя" className={fieldClass} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Username</span>
            <input name="handle" required minLength={2} placeholder="username" className={fieldClass} />
            <span className="text-xs text-orange-400/80">Username нельзя изменить после регистрации. Выбирайте обдуманно.</span>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Email</span>
            <input name="email" type="email" required placeholder="you@example.com" className={fieldClass} />
          </label>
        </>
      ) : (
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Email или username</span>
          <input name="login" required placeholder="Email или username" className={fieldClass} />
        </label>
      )}

      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Пароль</span>
        <input name="password" type="password" required minLength={8} placeholder="••••••••" className={fieldClass} />
      </label>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      {success ? (
        <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
          {previewLink ? (
            <div className="mt-2">
              <a href={previewLink} className="font-semibold underline underline-offset-4">Открыть письмо подтверждения</a>
            </div>
          ) : null}
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
        {pending ? "Отправляем..." : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
    </form>
  );
}

export function PasswordResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setSuccess("");

        const formData = new FormData(event.currentTarget);
        const password = String(formData.get("password") || "");
        const confirmPassword = String(formData.get("confirmPassword") || "");

        if (password !== confirmPassword) {
          setPending(false);
          setError("Пароли не совпадают.");
          return;
        }

        try {
          const response = await requestJson<{ message?: string }>("/api/auth/password-reset/confirm", {
            token,
            password,
          });
          setSuccess(response.message || "Пароль успешно изменён.");
          event.currentTarget.reset();
          window.setTimeout(() => {
            router.push("/auth/login");
            router.refresh();
          }, 1200);
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось изменить пароль.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Новый пароль</span>
        <input name="password" type="password" required minLength={8} placeholder="••••••••" className={fieldClass} />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Повторите пароль</span>
        <input name="confirmPassword" type="password" required minLength={8} placeholder="••••••••" className={fieldClass} />
      </label>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {success ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

      <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
        {pending ? "Сохраняем..." : "Сохранить новый пароль"}
      </button>
    </form>
  );
}

export function RealtimeBridge({ viewerId }: { viewerId: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closedByEffect = false;
    let refreshTimer: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, 160);
    };

    const shouldRefreshFeed = () =>
      pathname === "/" ||
      pathname.startsWith("/post/") ||
      pathname.startsWith("/profile/") ||
      pathname.startsWith("/clan/");

    const connect = async () => {
      try {
        const response = await fetch("/api/realtime/bootstrap", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { url?: string | null };

        if (!data.url) {
          return;
        }

        socket = new WebSocket(data.url);

        socket.onmessage = (message) => {
          const event = JSON.parse(message.data) as RealtimeIncomingEvent;

          if (event.type === "notification:new") {
            window.dispatchEvent(new CustomEvent("glyph:notification", { detail: event.payload.item }));
            window.dispatchEvent(new Event("glyph:notifications-changed"));

            if (pathname.startsWith("/notifications")) {
              scheduleRefresh();
            }

            return;
          }

          if (event.type === "feed:changed") {
            window.dispatchEvent(new Event("feed:changed"));

            if (shouldRefreshFeed()) {
              scheduleRefresh();
            }

            return;
          }

          if (event.type === "profile:changed" && pathname.startsWith("/profile/")) {
            scheduleRefresh();
          }
        };

        socket.onclose = () => {
          socket = null;

          if (!closedByEffect) {
            reconnectTimer = window.setTimeout(() => {
              void connect();
            }, 1800);
          }
        };
      } catch {
        reconnectTimer = window.setTimeout(() => {
          void connect();
        }, 2200);
      }
    };

    void connect();

    return () => {
      closedByEffect = true;

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      socket?.close();
    };
  }, [pathname, router, viewerId]);

  return null;
}

export function NotificationsReadBridge() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new Event("glyph:notifications-cleared"));
  }, []);

  return null;
}

function playNotificationChime() {
  const AudioContextClass =
    typeof window === "undefined"
      ? null
      : window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const context = new AudioContextClass();
  const now = context.currentTime;
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

  const oscillator = context.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(660, now);
  oscillator.frequency.linearRampToValueAtTime(990, now + 0.18);
  oscillator.frequency.linearRampToValueAtTime(780, now + 0.42);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + 0.55);

  window.setTimeout(() => void context.close(), 700);
}

function canUseDesktopNotifications() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.isSecureContext && typeof Notification !== "undefined";
}

function getDesktopNotificationPermission(): NotificationPermission {
  try {
    return canUseDesktopNotifications() ? Notification.permission : "denied";
  } catch {
    return "denied";
  }
}

export function DesktopSiteNotifications({
  viewerId,
  enabled = true,
}: {
  viewerId: string;
  enabled?: boolean;
}) {
  const isClient = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [permissionOverride, setPermissionOverride] = useState<NotificationPermission | null>(null);
  const [toasts, setToasts] = useState<LiveNotificationItem[]>([]);
  const permission = permissionOverride ?? (isClient ? getDesktopNotificationPermission() : "denied");

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }

    const onNotification = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<LiveNotificationItem>;
      const item = event.detail;

      if (!item?.id) {
        return;
      }

      playNotificationChime();
      setToasts((current) => [...current, item].slice(-4));

      if (getDesktopNotificationPermission() === "granted") {
        const notification = new Notification(item.title, {
          body: item.description,
          tag: item.id,
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = item.link;
        };
      }
    };

    window.addEventListener("glyph:notification", onNotification as EventListener);
    return () => window.removeEventListener("glyph:notification", onNotification as EventListener);
  }, [enabled, isClient, viewerId]);

  useEffect(() => {
    if (!toasts.length || typeof window === "undefined") {
      return;
    }

    const timers = toasts.map((toast, index) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 5200 + index * 350),
    );

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [toasts]);

  if (!isClient) {
    return null;
  }

  return (
    <>
      {enabled && permission === "default" ? (
        <div className="fixed bottom-6 right-6 z-[90] hidden w-[320px] rounded-[24px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_94%,black_6%)] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)] lg:block">
          <div className="text-sm font-semibold text-[var(--text)]">Уведомления на ПК</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Разрешите уведомления, и новые лайки, подписки и посты будут всплывать прямо на экране.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={async () => {
                if (!canUseDesktopNotifications()) {
                  setPermissionOverride("denied");
                  return;
                }

                try {
                  const nextPermission = await Notification.requestPermission();
                  setPermissionOverride(nextPermission);
                } catch {
                  setPermissionOverride("denied");
                }
              }}
              className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] hover:opacity-90"
            >
              Включить
            </button>
          </div>
        </div>
      ) : null}

      {toasts.length ? (
        <div className="fixed bottom-6 right-6 z-[95] hidden w-[360px] gap-3 lg:grid">
          {toasts.map((toast) => (
            <Link
              key={toast.id}
              href={toast.link}
              className="rounded-[22px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black_4%)] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[var(--text)]">{toast.title}</div>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{toast.description}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    setToasts((current) => current.filter((item) => item.id !== toast.id));
                  }}
                  className="rounded-full px-2 py-1 text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                >
                  ×
                </button>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function PostComposer({
  compact = false,
  groups = [],
  initialGroupSlug = "",
}: {
  compact?: boolean;
  groups?: Array<{ id: string; slug: string; name: string }>;
  initialGroupSlug?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targetGroupSlug, setTargetGroupSlug] = useState(initialGroupSlug);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const imagePath = imageFile ? await uploadFile(imageFile, "post") : "";
          await requestJson("/api/posts", {
            content: formData.get("content"),
            imagePath,
            pollQuestion: formData.get("pollQuestion"),
            pollOptions: [formData.get("optionOne"), formData.get("optionTwo"), formData.get("optionThree")],
            groupSlug: targetGroupSlug,
          });
          setMessage(targetGroupSlug ? "Пост опубликован в клане." : "Пост опубликован.");
          setImageFile(null);
          form.reset();
          setTargetGroupSlug(initialGroupSlug);
          window.dispatchEvent(new Event("feed:changed"));
          router.refresh();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось опубликовать пост.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="rounded-[28px] border border-[var(--line)] bg-[var(--panel-strong)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffb74d] text-lg text-black">🙂</div>
          <div className="flex-1">
            {groups.length ? (
              <div className="mb-3">
                <select
                  value={targetGroupSlug}
                  onChange={(event) => setTargetGroupSlug(event.target.value)}
                  className="w-full rounded-[16px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--muted)] outline-none"
                >
                  <option value="">Публиковать от своего профиля</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.slug}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <textarea
              name="content"
              required
              minLength={4}
              rows={compact ? 3 : 4}
              placeholder={targetGroupSlug ? "Что нового в клане?" : "Что нового?"}
              className="min-h-[76px] w-full resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[var(--muted)]">
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs hover:bg-white/[0.04]">
              <span>📎</span>
              <span>{imageFile ? imageFile.name : "Фото"}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setImageFile(event.target.files?.[0] || null)} className="hidden" />
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs">
              <span>◌</span>
              <input name="pollQuestion" placeholder="Вопрос опроса" className="w-28 bg-transparent outline-none placeholder:text-[var(--muted)] sm:w-40" />
            </label>
          </div>
          <button type="submit" disabled={pending} className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50 sm:w-auto">
            {pending ? "Публикуем..." : "Опубликовать"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <input name="optionOne" placeholder="Вариант 1" className={fieldClass} />
        <input name="optionTwo" placeholder="Вариант 2" className={fieldClass} />
        <input name="optionThree" placeholder="Вариант 3" className={fieldClass} />
      </div>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {message ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div> : null}
    </form>
  );
}

export function ProfileEditor({ user }: { user: User }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState(user.avatar.type === "emoji" ? user.avatar.value : "✨");

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const coverImagePath = coverFile ? await uploadFile(coverFile, "cover") : user.coverImage || "";

          await requestJson("/api/profile", {
            name: formData.get("name"),
            bio: formData.get("bio"),
            avatarEmoji: selectedEmoji,
            coverImagePath,
            themePreference: user.themePreference,
          });

          setMessage("Профиль обновлён.");
          router.refresh();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось обновить профиль.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Имя</span>
          <input name="name" defaultValue={user.name} required placeholder="Ваше имя" className={fieldClass} />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Эмодзи-аватар</span>
          <EmojiPicker onSelect={setSelectedEmoji} currentEmoji={selectedEmoji} />
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Описание</span>
        <textarea name="bio" rows={3} defaultValue={user.bio} placeholder="Расскажите о себе..." className={`${fieldClass} resize-none`} />
      </label>

      <div className="grid gap-4">
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Обложка профиля</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5 text-xs text-[var(--muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--page)]" />
        </label>
      </div>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {message ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
          {pending ? "Сохраняем..." : "Сохранить профиль"}
        </button>
      </div>
    </form>
  );
}

export function ClanCreateForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState("✨");

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const coverImagePath = coverFile ? await uploadFile(coverFile, "cover") : "";
          const response = await requestJson<{ slug: string }>("/api/clans/create", {
            name: formData.get("name"),
            slug: formData.get("slug"),
            description: formData.get("description"),
            avatarEmoji: selectedEmoji,
            coverImagePath,
          });

          setMessage("Клан создан.");
          router.push(`/clan/${response.slug}`);
          router.refresh();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось создать клан.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Название</span>
            <input name="name" required minLength={3} maxLength={120} placeholder="Например, Pixel Wolves" className={fieldClass} />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Slug</span>
            <input name="slug" maxLength={64} placeholder="pixel-wolves" className={fieldClass} />
          </label>
        </div>
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Эмодзи-аватар</span>
          <EmojiPicker onSelect={setSelectedEmoji} currentEmoji={selectedEmoji} />
        </label>
      </div>

      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Описание</span>
        <textarea
          name="description"
          rows={4}
          required
          minLength={12}
          maxLength={1200}
          placeholder="Коротко опишите идею, тематику и для кого этот клан."
          className={`${fieldClass} resize-none`}
        />
      </label>

      <label className="grid gap-2 text-sm">
        <span className="text-[var(--muted)]">Обложка клана</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
          className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5 text-xs text-[var(--muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--page)]"
        />
      </label>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {message ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
          {pending ? "Создаём..." : "Создать клан"}
        </button>
      </div>
    </form>
  );
}

export function VerificationForm({ status }: { status: VerificationStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const stateLabel = useMemo(() => {
    if (status === "approved") return "Профиль уже получил галочку.";
    if (status === "pending") return "Заявка уже на проверке. Можно дождаться решения модерации.";
    return "";
  }, [status]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (status !== "none") return;

        setPending(true);
        setMessage("");
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          if (!videoFile) {
            throw new Error("Прикрепите видео с лицом.");
          }

          const videoPath = await uploadFile(videoFile, "verification");
          await requestJson("/api/verification", {
            reason: formData.get("reason"),
            consent: formData.get("consent") === "on",
            videoPath,
          });
          setMessage("Заявка на верификацию отправлена.");
          form.reset();
          setVideoFile(null);
          router.refresh();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось отправить заявку.");
        } finally {
          setPending(false);
        }
      }}
    >
      {stateLabel ? <div className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--muted)]">{stateLabel}</div> : null}

      <label className="grid gap-2 text-sm">
        <span>Почему вам нужна галочка</span>
        <textarea name="reason" rows={4} required disabled={status !== "none"} className={`${fieldClass} resize-none disabled:opacity-60`} />
      </label>

      <label className="grid gap-2 text-sm">
        <span>Видео MP4, WebM или MOV до 50 МБ</span>
        <input type="file" accept="video/mp4,video/webm,video/quicktime" disabled={status !== "none"} onChange={(event) => setVideoFile(event.target.files?.[0] || null)} className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm" />
      </label>

      <label className="flex items-start gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm">
        <input type="checkbox" name="consent" disabled={status !== "none"} className="mt-1" />
        <span>Согласен(на) на отправку видеоматериала со своим лицом для ручной проверки профиля.</span>
      </label>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {message ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending || status !== "none"} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
          {pending ? "Отправляем..." : "Отправить на верификацию"}
        </button>
      </div>
    </form>
  );
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end bg-black/70 p-2 backdrop-blur-sm sm:items-center sm:justify-center sm:p-4" onClick={onClose}>
      <div className="relative max-h-[88vh] w-full overflow-y-auto rounded-[24px] border border-[var(--line)] bg-[var(--panel)] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)] sm:max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between rounded-t-[24px] border-b border-[var(--line)] bg-[var(--panel)] px-4 py-4 sm:px-6">
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl px-2 py-1 text-2xl leading-none text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]" aria-label="Закрыть окно">
            ×
          </button>
        </div>
        <div className="p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ProfileSettingsModal({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--page)] hover:opacity-90">
        Редактировать
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Редактировать профиль">
        <ProfileEditor user={user} />
      </Modal>
    </>
  );
}

export function VerificationModal({ status }: { status: VerificationStatus }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]">
        Верификация
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Верификация профиля">
        <VerificationForm status={status} />
      </Modal>
    </>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <div className="h-6 w-11 rounded-full bg-[var(--panel-strong)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-[var(--muted)] after:transition-all after:content-[''] peer-checked:bg-[var(--accent)] peer-checked:after:translate-x-full peer-checked:after:bg-[var(--page)]" />
    </label>
  );
}

export function SettingsModal({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>(user.themePreference);
  const [notifications, setNotifications] = useState(user.notificationsEnabled);
  const [privateProfile, setPrivateProfile] = useState(user.privateProfile);
  const [pending, setPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setTheme(user.themePreference);
    setNotifications(user.notificationsEnabled);
    setPrivateProfile(user.privateProfile);
  }, [user.themePreference, user.notificationsEnabled, user.privateProfile]);

  const saveSettings = async (next: {
    themePreference: ThemePreference;
    notificationsEnabled: boolean;
    privateProfile: boolean;
  }) => {
    setPending(true);
    setError("");
    setSuccess("");

    try {
      await requestJson("/api/account/settings", next);
      setTheme(next.themePreference);
      setNotifications(next.notificationsEnabled);
      setPrivateProfile(next.privateProfile);
      applyTheme(next.themePreference);
      setSuccess("Настройки сохранены.");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось сохранить настройки.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]">
        Настройки
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Настройки">
        <div className="grid gap-6">
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold text-[var(--text)]">Тема оформления</h3>
            <div className="grid w-full grid-cols-1 gap-2 rounded-[24px] bg-[var(--panel-strong)] p-2 sm:grid-cols-3 sm:gap-1 sm:rounded-full">
                {(["dark", "light", "system"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={pending}
                    onClick={() => saveSettings({
                      themePreference: item,
                      notificationsEnabled: notifications,
                      privateProfile,
                    })}
                    className={joinClasses(toggleBase, theme === item ? "bg-white/[0.08] text-[var(--text)]" : "text-[var(--muted)]")}
                  >
                    {item === "dark" ? "Тёмная" : item === "light" ? "Светлая" : "Системная"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
              <div>
                <div className="text-sm font-medium text-[var(--text)]">Уведомления</div>
                <div className="text-xs text-[var(--muted)]">Получать уведомления в системе и всплывающие оповещения</div>
              </div>
              <Switch
                checked={notifications}
                onChange={() =>
                  saveSettings({
                    themePreference: theme,
                    notificationsEnabled: !notifications,
                    privateProfile,
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
              <div>
                <div className="text-sm font-medium text-[var(--text)]">Приватный профиль</div>
                <div className="text-xs text-[var(--muted)]">Только ваши подписчики смогут видеть посты и лайки профиля</div>
              </div>
              <Switch
                checked={privateProfile}
                onChange={() =>
                  saveSettings({
                    themePreference: theme,
                    notificationsEnabled: notifications,
                    privateProfile: !privateProfile,
                  })
                }
              />
            </div>

            {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
            {success ? <div className="rounded-[18px] border border-emerald-500/18 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{success}</div> : null}

            <div className="border-t border-[var(--line)]" />

            <div className="grid gap-3">
              <h3 className="text-sm font-semibold text-[var(--text)]">Аккаунт</h3>
              <LogoutButton />
              <button
                type="button"
                disabled={passwordPending}
                onClick={async () => {
                  setPasswordPending(true);
                  setError("");
                  setSuccess("");

                  try {
                    const response = await requestJson<{ message?: string }>("/api/account/password-reset", {});
                    setSuccess(response.message || "Письмо для смены пароля отправлено.");
                  } catch (value) {
                    setError(value instanceof Error ? value.message : "Не удалось отправить письмо для смены пароля.");
                  } finally {
                    setPasswordPending(false);
                  }
                }}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-left text-sm text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:opacity-50"
              >
                {passwordPending ? "Отправляем письмо..." : "Изменить пароль"}
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm text-rose-400 hover:bg-rose-500/20"
                >
                  Удалить аккаунт
                </button>
              ) : (
                <div className="grid gap-3 rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4">
                  <div className="text-sm leading-6 text-rose-300">
                    Аккаунт будет удалён вместе с вашими постами, комментариями, лайками и сессиями. Это действие нельзя отменить.
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      disabled={deletePending}
                      onClick={async () => {
                        setDeletePending(true);
                        setError("");

                        try {
                          await requestJson("/api/account/delete", {});
                          window.location.href = "/";
                        } catch (value) {
                          setError(value instanceof Error ? value.message : "Не удалось удалить аккаунт.");
                        } finally {
                          setDeletePending(false);
                        }
                      }}
                      className="rounded-full bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {deletePending ? "Удаляем..." : "Подтвердить удаление"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      </>
    );
}

export function AdminDeletePostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
      >
        {pending ? "Удаляем..." : "Удалить пост"}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Удалить пост">
        <div className="grid gap-4">
          <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-200">
            Пост будет удалён из ленты вместе со всеми его репостами. Это действие нельзя отменить.
          </div>

          {error ? (
            <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError("");

                try {
                  await requestJson("/api/admin/posts/delete", { postId });
                  setIsOpen(false);
                  window.dispatchEvent(new Event("feed:changed"));
                  router.refresh();
                } catch (value) {
                  setError(value instanceof Error ? value.message : "Не удалось удалить пост.");
                } finally {
                  setPending(false);
                }
              }}
              className="rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Удаляем..." : "Подтвердить удаление"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function VerificationReviewButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const review = (decision: "approved" | "rejected") =>
    startTransition(async () => {
      try {
        await requestJson("/api/admin/verification", { requestId, decision });
        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Не удалось обработать заявку.");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => review("approved")}
        className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "..." : "Одобрить"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => review("rejected")}
        className="rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
      >
        Отклонить
      </button>
    </div>
  );
}

export function ReportReviewButtons({
  reportId,
  status,
}: {
  reportId: string;
  status: AdminPostReport["status"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (status !== "open") {
    return (
      <div className={joinClasses(
        "rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]",
        status === "resolved" ? "bg-emerald-500/12 text-emerald-300" : "bg-white/[0.06] text-[var(--muted)]",
      )}>
        {status === "resolved" ? "Решено" : "Отклонено"}
      </div>
    );
  }

  const review = (decision: "resolved" | "dismissed") =>
    startTransition(async () => {
      try {
        await requestJson("/api/admin/reports", { reportId, decision });
        router.refresh();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Не удалось обработать жалобу.");
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => review("resolved")}
        className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "..." : "Принять"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => review("dismissed")}
        className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:opacity-50"
      >
        Отклонить
      </button>
    </div>
  );
}

export function RevokeVerificationButton({
  userId,
  disabled = false,
}: {
  userId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const confirmed = window.confirm("Отозвать верификацию у этого профиля?");

          if (!confirmed) {
            return;
          }

          try {
            await requestJson("/api/admin/verification/revoke", { userId });
            router.refresh();
          } catch (error) {
            window.alert(error instanceof Error ? error.message : "Не удалось отозвать верификацию.");
          }
        })
      }
      className="rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
    >
      {pending ? "..." : "Отозвать"}
    </button>
  );
}
