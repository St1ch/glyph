"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { AdminPostReport, DecoratedPost, DecoratedPostComment, DirectMessage, Group, MessageConversation, MessageUserSummary, ThemePreference, User, VerificationStatus } from "@/lib/types";
import { formatRelativeDate, imageTypes, isHeicAssetUrl, joinClasses, uploadLimits, verificationVideoTypes, videoTypes } from "@/lib/site";
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
  link?: string;
  createdAt: string;
};

function emitLocalToast(title: string, description: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("glyph:toast", {
      detail: {
        id: window.crypto?.randomUUID?.() || `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        createdAt: new Date().toISOString(),
      } satisfies LiveNotificationItem,
    }),
  );
}

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
    }
  | {
      type: "message:new";
      payload: {
        conversationId: string;
        messageId: string;
        senderId: string;
      };
    }
  | {
      type: "message:changed";
      payload: {
        conversationId: string;
        messageId: string;
      };
    }
  | {
      type: "message:typing";
      payload: {
        conversationId: string;
        senderId: string;
      };
    };

type UploadKind = "avatar" | "cover" | "post" | "message" | "verification";

function getUploadLimitText(kind: UploadKind) {
  const maxMb = Math.round(uploadLimits[kind] / (1024 * 1024));

  if (kind === "verification") {
    return `Максимальный размер видео — ${maxMb} МБ. Поддерживаются форматы: ${verificationVideoTypes.join(", ")}.`;
  }

  if (kind === "avatar") {
    return `Максимальный размер изображения для аватара — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP, GIF, HEIC и HEIF.`;
  }

  if (kind === "cover") {
    return `Максимальный размер изображения для обложки — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP, GIF, HEIC и HEIF.`;
  }

  if (kind === "message") {
    return `Максимальный размер вложения — ${maxMb} МБ. Поддерживаются изображения JPG, PNG, WEBP, GIF, HEIC, HEIF и видео MP4, WebM, MOV.`;
  }

  return `Максимальный размер изображения — ${maxMb} МБ. Поддерживаются JPG, PNG, WEBP, GIF, HEIC и HEIF.`;
}

async function uploadFile(file: File, kind: UploadKind) {
  if (kind === "verification") {
    if (!verificationVideoTypes.includes(file.type as (typeof verificationVideoTypes)[number])) {
      throw new Error("Поддерживаются только видео MP4, WebM или MOV.");
    }
  } else if (kind === "message") {
    const supported =
      imageTypes.includes(file.type as (typeof imageTypes)[number]) ||
      videoTypes.includes(file.type as (typeof videoTypes)[number]);

    if (!supported) {
      throw new Error("Поддерживаются изображения JPG, PNG, WEBP, GIF, HEIC, HEIF и видео MP4, WebM, MOV.");
    }
  } else if (!imageTypes.includes(file.type as (typeof imageTypes)[number])) {
    throw new Error("Поддерживаются только изображения JPG, PNG, WEBP, GIF, HEIC и HEIF.");
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
    credentials: "include",
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
    <div className="fixed inset-x-4 bottom-4 z-[88] rounded-[24px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black_4%)] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)] sm:bottom-6 sm:left-6 sm:right-auto sm:w-[340px]">
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
  const common = "h-5 w-5 shrink-0";
  const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (icon === "feed") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
        <path d="M5 6.5h14M5 12h14M5 17.5h9" />
      </svg>
    );
  }

  if (icon === "search") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
        <path d="M10.5 17a6.5 6.5 0 1 1 4.6-1.9L20 20" />
      </svg>
    );
  }

  if (icon === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
        <path d="M18 10.5v3.8l1.5 2.2H4.5L6 14.3v-3.8a6 6 0 0 1 12 0ZM9.8 19a2.4 2.4 0 0 0 4.4 0" />
      </svg>
    );
  }

  if (icon === "message") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
        <path d="M5.5 6.5A2.5 2.5 0 0 1 8 4h8a2.5 2.5 0 0 1 2.5 2.5v5A2.5 2.5 0 0 1 16 14h-4.2L7 18v-4H8a2.5 2.5 0 0 1-2.5-2.5v-5Z" />
      </svg>
    );
  }

  if (icon === "group") {
    return (
      <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
        <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 10a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2ZM3.5 19a5 5 0 0 1 9 0M13.5 18.5a4 4 0 0 1 6.5 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={common} aria-hidden="true" {...strokeProps}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0" />
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

function useUnreadMessageCount({
  enabled,
  initialCount,
}: {
  enabled: boolean;
  initialCount: number;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const visibleCount = pathname.startsWith("/messages") ? 0 : count;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const onMessage = () => {
      if (!pathname.startsWith("/messages")) {
        setCount((current) => current + 1);
      }
    };
    const onCleared = () => setCount(0);

    window.addEventListener("glyph:messages-changed", onMessage);
    window.addEventListener("glyph:messages-cleared", onCleared);

    return () => {
      window.removeEventListener("glyph:messages-changed", onMessage);
      window.removeEventListener("glyph:messages-cleared", onCleared);
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
  initialMessageCount = 0,
}: {
  href: string;
  label: string;
  icon: "feed" | "search" | "bell" | "message" | "profile" | "group";
  viewerId?: string;
  initialNotificationCount?: number;
  initialMessageCount?: number;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  const unreadCount = useUnreadNotificationCount({
    enabled: href === "/notifications" && Boolean(viewerId),
    initialCount: initialNotificationCount,
  });
  const unreadMessageCount = useUnreadMessageCount({
    enabled: href === "/messages" && Boolean(viewerId),
    initialCount: initialMessageCount,
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
        {href === "/messages" && unreadMessageCount > 0 ? (
          <span className="absolute -right-2.5 -top-2.5 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--page)] shadow-[0_10px_24px_-12px_rgba(132,184,44,0.9)]">
            {formatNotificationBadge(unreadMessageCount)}
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

        if (shouldIgnore(event.target)) {
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
  const useNativeImage = isHeicAssetUrl(src) || src.startsWith("/api/assets/");

  return (
    <>
      <button
        type="button"
        data-no-post-open="true"
        onClick={() => setIsOpen(true)}
        className={joinClasses("block w-full overflow-hidden rounded-[22px]", className)}
      >
        {useNativeImage ? (
          <img
            alt={alt}
            src={src}
            className={joinClasses("w-full border border-[var(--line)] object-cover", maxPreviewHeightClass ?? "max-h-[480px]")}
          />
        ) : (
          <Image
            alt={alt}
            src={src}
            width={width}
            height={height}
            className={joinClasses("w-full border border-[var(--line)] object-cover", maxPreviewHeightClass ?? "max-h-[480px]")}
          />
        )}
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Просмотр изображения">
        <div className="grid gap-4" data-no-post-open="true">
          {useNativeImage ? (
            <img
              alt={alt}
              src={src}
              className="max-h-[75vh] w-full rounded-[22px] object-contain"
            />
          ) : (
            <Image
              alt={alt}
              src={src}
              width={1600}
              height={1200}
              className="max-h-[75vh] w-full rounded-[22px] object-contain"
            />
          )}
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
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reportReason, setReportReason] = useState("spam");
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
  const isAdminPage = pathname.startsWith("/admin");

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
              disabled={isAdminPage ? pending : disabledReport}
              onClick={() => {
                if (isAdminPage) {
                  setIsOpen(false);
                  setIsDeleteConfirmOpen(true);
                  return;
                }

                setIsOpen(false);
                setIsReportOpen(true);
              }}
              className="rounded-[14px] px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdminPage ? (pending ? "Удаляем..." : "Удалить пост") : disabledReport ? "Войдите, чтобы пожаловаться" : "Пожаловаться"}
            </button>
          </div>
        ) : null}
      </div>

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Удалить пост">
        <div className="grid gap-4">
          <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-200">
            Удалить этот пост? Это действие нельзя отменить.
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setPending(true);

                requestJson("/api/admin/posts/delete", { postId })
                  .then(() => {
                    setIsDeleteConfirmOpen(false);
                    window.dispatchEvent(new Event("feed:changed"));
                    window.location.reload();
                  })
                  .catch((value) => {
                    window.alert(value instanceof Error ? value.message : "Не удалось удалить пост.");
                  })
                  .finally(() => {
                    setPending(false);
                  });
              }}
              className="rounded-full bg-rose-500 px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Удаляем..." : "Удалить пост"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} title="Пожаловаться на пост">
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const formData = new FormData(event.currentTarget);
            const payload = {
              postId,
              reason: reportReason,
              details: String(formData.get("details") || ""),
            };

            try {
              await requestJson("/api/posts/report", payload);
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
              {reportCategories.map((category) => (
                <label
                  key={category.value}
                  className="flex cursor-pointer items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 text-sm hover:bg-white/[0.04]"
                >
                  <input
                    type="radio"
                    name="category"
                    value={category.value}
                    checked={reportReason === category.value}
                    onChange={() => setReportReason(category.value)}
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
  const [selectedEmoji, setSelectedEmoji] = useState("✨");

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
                  pwa:
                    window.matchMedia("(display-mode: standalone)").matches ||
                    ((navigator as Navigator & { standalone?: boolean }).standalone === true),
              }
            : {
                name: formData.get("name"),
                handle: formData.get("handle"),
                email: formData.get("email"),
                password: formData.get("password"),
                avatarEmoji: selectedEmoji,
              };

        try {
          const response = await requestJson<{ message?: string; verificationLink?: string }>(`/api/auth/${mode}`, payload);

          if (mode === "login") {
            router.push("/");
            router.refresh();
            return;
            }

            setSuccess(response.message || "Аккаунт создан. Подтвердите почту, затем войдите. Если письма нет, проверьте папку «Спам».");
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
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--muted)]">Эмодзи-аватар</span>
            <EmojiPicker onSelect={setSelectedEmoji} currentEmoji={selectedEmoji} />
            <span className="text-xs text-orange-400/80">
              Эмодзи выбирается при регистрации и становится вашим аватаром в GLYPH. Лучше выбрать обдуманно.
            </span>
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
    let connected = false;
    let refreshTimer: number | null = null;
    let presenceTimer: number | null = null;

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

        socket.onopen = () => {
          connected = true;
        };

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
            return;
          }

          if (event.type === "message:new" || event.type === "message:changed") {
            window.dispatchEvent(new Event("glyph:messages-changed"));

            if (pathname.startsWith("/messages")) {
              scheduleRefresh();
            }

            return;
          }

          if (event.type === "message:typing") {
            window.dispatchEvent(new CustomEvent("glyph:message-typing", { detail: event.payload }));
          }
        };

        socket.onclose = () => {
          socket = null;

          if (!closedByEffect && connected) {
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
    const sendSocketEvent = (type: string, detail: Record<string, string>) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(
        JSON.stringify({
          type,
          payload: detail,
        }),
      );
    };

    const onTypingSend = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ conversationId: string; recipientId: string }>;
      sendSocketEvent("message:typing", event.detail);
    };
    const onActiveConversation = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ conversationId: string }>;
      sendSocketEvent("message:conversation-active", event.detail);
    };

    window.addEventListener("glyph:message-typing-send", onTypingSend as EventListener);
    window.addEventListener("glyph:message-conversation-active", onActiveConversation as EventListener);
    presenceTimer = window.setInterval(() => {
      void fetch("/api/realtime/bootstrap", { cache: "no-store" });
    }, 45000);

    return () => {
      closedByEffect = true;

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }

      if (presenceTimer !== null) {
        window.clearInterval(presenceTimer);
      }

      window.removeEventListener("glyph:message-typing-send", onTypingSend as EventListener);
      window.removeEventListener("glyph:message-conversation-active", onActiveConversation as EventListener);
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

function MessageAvatar({ user }: { user: MessageUserSummary }) {
  const statusDot = user.isOnline ? (
    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--panel)] bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
  ) : null;

  if (user.avatar.type === "image") {
    return (
      <div className="relative h-11 w-11 shrink-0">
        <Image
          alt={user.name}
          src={user.avatar.value}
          width={44}
          height={44}
          className="h-11 w-11 rounded-full border border-[var(--line)] object-cover"
        />
        {statusDot}
      </div>
    );
  }

  return (
    <div className="relative h-11 w-11 shrink-0">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] text-xl">
        {user.avatar.value}
      </div>
      {statusDot}
    </div>
  );
}

function MessageAuthorLine({ user }: { user: MessageUserSummary }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate text-sm font-semibold text-[var(--text)]">{user.name}</span>
      <span className="text-xs text-[var(--muted)]">@{user.handle}</span>
      {user.verificationStatus === "approved" ? (
        <span className="rounded-full bg-[#0f3b6c] px-2 py-0.5 text-[10px] font-semibold text-[#90c8ff]">Вериф.</span>
      ) : null}
    </div>
  );
}

function getMessageDateKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (getMessageDateKey(value) === getMessageDateKey(today.toISOString())) {
    return "Сегодня";
  }

  if (getMessageDateKey(value) === getMessageDateKey(yesterday.toISOString())) {
    return "Вчера";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatPresence(user: MessageUserSummary) {
  if (user.isOnline) {
    return "в сети";
  }

  if (!user.lastSeenAt) {
    return "был(а) давно";
  }

  return `был(а) ${formatRelativeDate(user.lastSeenAt)}`;
}

function isVideoMessageAsset(value: string | null | undefined) {
  return Boolean(value && /\.(mp4|webm|mov)(\?|$)/i.test(value));
}

function getMessageMediaLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return isVideoMessageAsset(value) ? "Видео" : "Фото";
}

function getMessageMediaGroupClass(count: number) {
  if (count === 1) {
    return "";
  }

  if (count === 2) {
    return "grid-cols-2";
  }

  return "grid-cols-2 sm:grid-cols-3";
}

function formatMediaTime(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function MessageMediaPreview({
  src,
  onOpen,
  grouped = false,
}: {
  src: string;
  onOpen: () => void;
  grouped?: boolean;
}) {
  const isVideo = isVideoMessageAsset(src);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={joinClasses(
        "group relative block overflow-hidden rounded-[18px] bg-black/35 text-left",
        grouped ? "aspect-square" : "w-[min(360px,76vw)] sm:w-[390px]",
      )}
      aria-label={isVideo ? "Открыть видео" : "Открыть изображение"}
    >
      {isVideo ? (
        <>
          <video
            src={src}
            preload="metadata"
            className={joinClasses(
              "w-full object-cover",
              grouped ? "h-full" : "max-h-[300px]",
            )}
            muted
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/18">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/62 text-white shadow-[0_18px_45px_-22px_rgba(0,0,0,0.9)] transition group-hover:scale-105">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
                <path d="M9 7.5v9l7-4.5-7-4.5Z" />
              </svg>
            </span>
          </span>
        </>
      ) : isHeicAssetUrl(src) ? (
        <img
          src={src}
          alt="Вложение"
          className={joinClasses(
            "w-full object-cover",
            grouped ? "h-full" : "max-h-[300px]",
          )}
        />
      ) : (
        <Image
          src={src}
          alt="Вложение"
          width={900}
          height={700}
          className={joinClasses(
            "w-full object-cover",
            grouped ? "h-full" : "h-auto max-h-[300px]",
          )}
        />
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
        {getMessageMediaLabel(src)}
      </span>
    </button>
  );
}

function MessageMediaViewer({
  items,
  currentIndex,
  onClose,
  onNavigate,
}: {
  items: Array<{ src: string; label: string }>;
  currentIndex: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const media = currentIndex === null ? null : items[currentIndex] ?? null;

  useEffect(() => {
    if (!media) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft" && currentIndex !== null && items.length > 1) {
        onNavigate((currentIndex - 1 + items.length) % items.length);
      }
      if (event.key === "ArrowRight" && currentIndex !== null && items.length > 1) {
        onNavigate((currentIndex + 1) % items.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentIndex, items.length, media, onClose, onNavigate]);

  if (!media) {
    return null;
  }

  const isVideo = isVideoMessageAsset(media.src);

  return createPortal(
    <div className="fixed inset-0 z-[120] grid bg-black/88 backdrop-blur-md" onClick={onClose}>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 text-white/80">
        <div className="rounded-full bg-black/30 px-3 py-1 text-sm">{media.label}</div>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-2xl leading-none hover:bg-white/10"
          aria-label="Закрыть просмотр"
        >
          ×
        </button>
      </div>
      <div className="flex min-h-0 items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
        {isVideo ? (
          <MessageVideoPlayer src={media.src} />
        ) : isHeicAssetUrl(media.src) ? (
          <img src={media.src} alt={media.label} className="max-h-[86vh] max-w-[92vw] rounded-[22px] object-contain shadow-[0_30px_90px_-42px_rgba(0,0,0,0.95)]" />
        ) : (
          <Image src={media.src} alt={media.label} width={1600} height={1200} className="max-h-[86vh] max-w-[92vw] rounded-[22px] object-contain shadow-[0_30px_90px_-42px_rgba(0,0,0,0.95)]" />
        )}
      </div>
      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(((currentIndex ?? 0) - 1 + items.length) % items.length);
            }}
            className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-3xl text-white/80 hover:bg-white/10"
            aria-label="Предыдущее медиа"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(((currentIndex ?? 0) + 1) % items.length);
            }}
            className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-3xl text-white/80 hover:bg-white/10"
            aria-label="Следующее медиа"
          >
            ›
          </button>
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between p-4 text-white/70">
        <div className="rounded-full bg-black/30 px-3 py-1 text-xs">
          {items.length > 1 ? `${(currentIndex ?? 0) + 1} из ${items.length} · ← → листать · Esc — закрыть` : "Esc — закрыть"}
        </div>
        <a
          href={media.src}
          download
          className="pointer-events-auto rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/16"
          onClick={(event) => event.stopPropagation()}
        >
          Скачать
        </a>
      </div>
    </div>,
    document.body,
  );
}

function MessageVideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hideControlsTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    return () => {
      if (hideControlsTimerRef.current !== null) {
        window.clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  const showControls = () => {
    setControlsVisible(true);

    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
    }

    hideControlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 1800);
  };

  const togglePlay = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
      setPlaying(true);
      showControls();
    } else {
      video.pause();
      setPlaying(false);
      setControlsVisible(true);
    }
  };

  const seek = (value: number) => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.currentTime = value;
    setCurrentTime(value);
  };

  const changeVolume = (value: number) => {
    const video = videoRef.current;

    setVolume(value);

    if (video) {
      video.volume = value;
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-white/10 bg-black shadow-[0_30px_90px_-42px_rgba(0,0,0,0.95)]"
      onMouseEnter={showControls}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing) {
          setControlsVisible(false);
        }
      }}
      onFocusCapture={() => setControlsVisible(true)}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        className="max-h-[86vh] max-w-[92vw] bg-black"
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          event.currentTarget.volume = volume;
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => {
          setPlaying(true);
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
      />
      <div
        className={joinClasses(
          "absolute inset-x-3 bottom-3 rounded-[18px] border border-white/10 bg-black/62 p-3 text-white shadow-[0_18px_50px_-28px_rgba(0,0,0,0.95)] backdrop-blur transition duration-200",
          controlsVisible || !playing ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none",
        )}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => seek(Number(event.target.value))}
          className="w-full accent-[var(--accent)]"
          aria-label="Прогресс видео"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold hover:bg-white/16"
            aria-label={playing ? "Пауза" : "Воспроизвести"}
          >
            {playing ? "Ⅱ" : "▶"}
          </button>
          <div className="min-w-[88px] text-xs text-white/78">
            {formatMediaTime(currentTime)} / {formatMediaTime(duration)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-white/65">Звук</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(event) => changeVolume(Number(event.target.value))}
              className="w-24 accent-[var(--accent)]"
              aria-label="Громкость видео"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessagesPanel({
  viewerId,
  conversations,
  messages,
  activeConversation,
  candidates,
  search,
}: {
  viewerId: string;
  conversations: MessageConversation[];
  messages: DirectMessage[];
  activeConversation: MessageConversation | null;
  candidates: MessageUserSummary[];
  search: string;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pendingConversationHandle, setPendingConversationHandle] = useState("");
  const [pendingMessage, setPendingMessage] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [typingConversationId, setTypingConversationId] = useState("");
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const [messageFilePreviews, setMessageFilePreviews] = useState<Array<{ name: string; url: string; type: string }>>([]);
  const [openMediaIndex, setOpenMediaIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: DirectMessage } | null>(null);
  const [replyTarget, setReplyTarget] = useState<DirectMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<DirectMessage | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<DirectMessage | null>(null);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatMessageSearch, setChatMessageSearch] = useState("");
  const lastTypingSentAtRef = useRef(0);
  const chatMenuRef = useRef<HTMLDivElement | null>(null);
  const mediaItems = useMemo(
    () =>
      messages.flatMap((message) =>
        message.mediaPaths.map((src) => ({
          src,
          label: `${getMessageMediaLabel(src)} от ${message.sender.name}`,
        })),
      ),
    [messages],
  );
  const visibleMessages = useMemo(() => {
    const query = chatMessageSearch.trim().toLowerCase();

    if (!query) {
      return messages;
    }

    return messages.filter((message) => {
      const mediaLabel = message.mediaPaths.map((path) => getMessageMediaLabel(path)).join(" ");
      return `${message.content} ${message.sender.name} ${mediaLabel}`.toLowerCase().includes(query);
    });
  }, [chatMessageSearch, messages]);

  useEffect(() => {
    window.dispatchEvent(new Event("glyph:messages-cleared"));
  }, []);

  useEffect(() => {
    const previews = messageFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
    }));

    setMessageFilePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [messageFiles]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeConversation?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh();
    }, 45000);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    setChatMenuOpen(false);
    setChatSearchOpen(false);
    setChatMessageSearch("");

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        router.push("/messages");
        router.refresh();
      }
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeConversation, router]);

  useEffect(() => {
    if (!activeConversation) {
      return;
    }

    const announceActiveConversation = () => {
      window.dispatchEvent(
        new CustomEvent("glyph:message-conversation-active", {
          detail: {
            conversationId: activeConversation.id,
          },
        }),
      );
    };

    announceActiveConversation();
    const timer = window.setInterval(announceActiveConversation, 15000);

    const onTyping = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ conversationId: string; senderId: string }>;

      if (
        event.detail.conversationId !== activeConversation.id ||
        event.detail.senderId !== activeConversation.participant.id
      ) {
        return;
      }

      setTypingConversationId(event.detail.conversationId);
      window.setTimeout(() => {
        setTypingConversationId((current) => (current === event.detail.conversationId ? "" : current));
      }, 2600);
    };

    window.addEventListener("glyph:message-typing", onTyping as EventListener);

    return () => {
      window.clearInterval(timer);
      window.dispatchEvent(
        new CustomEvent("glyph:message-conversation-active", {
          detail: {
            conversationId: "",
          },
        }),
      );
      window.removeEventListener("glyph:message-typing", onTyping as EventListener);
    };
  }, [activeConversation]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);

    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);

    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!chatMenuOpen) {
      return;
    }

    const close = (event: MouseEvent) => {
      if (chatMenuRef.current && event.target instanceof Node && !chatMenuRef.current.contains(event.target)) {
        setChatMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", close);

    return () => {
      window.removeEventListener("mousedown", close);
    };
  }, [chatMenuOpen]);

  const updateMessageText = (value: string) => {
    setMessageText(value);

    if (!activeConversation || !value.trim()) {
      return;
    }

    const now = Date.now();

    if (now - lastTypingSentAtRef.current < 1400) {
      return;
    }

    lastTypingSentAtRef.current = now;
    window.dispatchEvent(
      new CustomEvent("glyph:message-typing-send", {
        detail: {
          conversationId: activeConversation.id,
          recipientId: activeConversation.participant.id,
        },
      }),
    );
  };

  const startConversation = async (handle: string) => {
    setPendingConversationHandle(handle);
    setError("");

    try {
      const response = await requestJson<{ conversationId: string }>("/api/messages/start", { handle });
      router.push(`/messages?conversation=${response.conversationId}`);
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось открыть диалог.");
    } finally {
      setPendingConversationHandle("");
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeConversation || pendingMessage) {
      return;
    }

    setPendingMessage(true);
    setError("");

    try {
      if (editingMessage) {
        await requestJson("/api/messages/edit", {
          messageId: editingMessage.id,
          content: messageText,
        });
      } else if (messageFiles.length) {
        const uploadedPaths: string[] = [];

        for (const file of messageFiles) {
          uploadedPaths.push(await uploadFile(file, "message"));
        }

        await requestJson("/api/messages/send", {
          conversationId: activeConversation.id,
          content: messageText,
          mediaPath: uploadedPaths[0] ?? "",
          mediaPaths: uploadedPaths,
          replyToMessageId: replyTarget?.id ?? "",
        });
      } else {
        await requestJson("/api/messages/send", {
          conversationId: activeConversation.id,
          content: messageText,
          mediaPath: "",
          replyToMessageId: replyTarget?.id ?? "",
        });
      }
      setMessageText("");
      setMessageFiles([]);
      setReplyTarget(null);
      setEditingMessage(null);
      window.dispatchEvent(new Event("glyph:messages-changed"));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось отправить сообщение.");
    } finally {
      setPendingMessage(false);
    }
  };

  const copyMessageText = async (message: DirectMessage) => {
    if (!message.content || typeof navigator === "undefined") {
      return;
    }

    await navigator.clipboard.writeText(message.content);
  };

  const startReply = (message: DirectMessage) => {
    if (message.deletedForAll) {
      return;
    }

    setEditingMessage(null);
    setReplyTarget(message);
    setContextMenu(null);
  };

  const startEdit = (message: DirectMessage) => {
    if (message.senderId !== viewerId || message.deletedForAll || message.mediaPaths.length) {
      return;
    }

    setReplyTarget(null);
    setEditingMessage(message);
    setMessageText(message.content);
    setContextMenu(null);
  };

  const deleteMessage = async (message: DirectMessage, scope: "me" | "all") => {
    setContextMenu(null);
    setError("");

    try {
      await requestJson("/api/messages/delete", {
        messageId: message.id,
        scope,
      });
      window.dispatchEvent(new Event("glyph:messages-changed"));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось удалить сообщение.");
    }
  };

  const forwardMessage = async (conversationId: string) => {
    if (!forwardingMessage) {
      return;
    }

    setError("");

    try {
      await requestJson("/api/messages/forward", {
        messageId: forwardingMessage.id,
        conversationId,
      });
      setForwardingMessage(null);
      window.dispatchEvent(new Event("glyph:messages-changed"));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Не удалось переслать сообщение.");
    }
  };

  return (
    <div className="grid h-full overflow-hidden rounded-none border border-[var(--line)] bg-[var(--panel)] shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)] lg:grid-cols-[360px_minmax(0,1fr)] min-[2400px]:lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside
        className={joinClasses(
          "min-h-0 flex-col border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_88%,black)] lg:flex lg:border-b-0 lg:border-r",
          activeConversation ? "hidden" : "flex",
        )}
      >
        <form action="/messages" className="relative flex min-h-[72px] items-center border-b border-[var(--line)] p-4">
          <div className="flex w-full items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Найти собеседника</span>
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Поиск"
                className="h-10 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-sm outline-none transition focus:border-[var(--accent)]/70"
              />
            </label>
            <button
              type="submit"
              className="h-10 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--page)] hover:opacity-90"
            >
              Найти
            </button>
          </div>
        </form>

        {candidates.length ? (
          <div className="grid gap-2 border-b border-[var(--line)] p-3">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                disabled={Boolean(pendingConversationHandle)}
                onClick={() => startConversation(candidate.handle)}
                className="flex items-center gap-3 rounded-[22px] bg-[var(--panel-soft)] p-3 text-left transition hover:bg-white/[0.04] disabled:opacity-50"
              >
                <MessageAvatar user={candidate} />
                <div className="min-w-0 flex-1">
                  <MessageAuthorLine user={candidate} />
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {pendingConversationHandle === candidate.handle ? "Открываем..." : "Начать диалог"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="min-h-[260px] flex-1 overflow-y-auto p-3">
          <div className="mb-2 px-2 text-sm font-semibold text-[var(--text)]">Диалоги</div>
          {conversations.length ? (
            conversations.map((conversation) => {
              const active = activeConversation?.id === conversation.id;

              return (
                <Link
                  key={conversation.id}
                  href={`/messages?conversation=${conversation.id}`}
                  className={joinClasses(
                    "mb-2 flex items-center gap-3 rounded-[22px] p-3 transition",
                    active
                      ? "bg-[var(--accent)]/16"
                      : "hover:bg-white/[0.04]",
                  )}
                >
                  <MessageAvatar user={conversation.participant} />
                  <div className="min-w-0 flex-1">
                    <MessageAuthorLine user={conversation.participant} />
                    <div className="mt-1 truncate text-xs text-[var(--muted)]">
                      {conversation.lastMessage?.content ||
                        getMessageMediaLabel(conversation.lastMessage?.imagePath) ||
                        "Диалог создан"}
                    </div>
                  </div>
                  {conversation.unreadCount > 0 ? (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-[var(--page)]">
                      {formatNotificationBadge(conversation.unreadCount)}
                    </span>
                  ) : null}
                </Link>
              );
            })
          ) : (
            <div className="rounded-[22px] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
              Пока нет диалогов. Найдите пользователя выше и начните переписку.
            </div>
          )}
        </div>
      </aside>

      <section
        className={joinClasses(
          "message-chat-surface min-h-[620px] min-w-0 flex-col overflow-hidden lg:flex lg:min-h-0",
          activeConversation ? "flex" : "hidden",
        )}
      >
        {activeConversation ? (
          <>
            <div className="message-chat-header relative flex min-h-[72px] items-center justify-between gap-3 overflow-visible border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_92%,black)] px-4 py-3">
              {chatSearchOpen ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Поиск по сообщениям</span>
                    <input
                      type="search"
                      value={chatMessageSearch}
                      onChange={(event) => setChatMessageSearch(event.target.value)}
                      autoFocus
                      placeholder="Найти сообщение..."
                      className="h-11 w-full rounded-full border border-[var(--accent)]/55 bg-[var(--panel-soft)] px-4 text-sm outline-none shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_16%,transparent)] transition"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setChatMessageSearch("");
                      setChatSearchOpen(false);
                    }}
                    className="h-11 rounded-full border border-[var(--line)] px-4 text-sm font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                  >
                    Закрыть
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/messages"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)] lg:hidden"
                  aria-label="Вернуться к списку диалогов"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <MessageAvatar user={activeConversation.participant} />
                <div className="min-w-0">
                  <MessageAuthorLine user={activeConversation.participant} />
                  <div className={joinClasses("mt-1 text-xs", activeConversation.participant.isOnline ? "text-emerald-300" : "text-[var(--muted)]")}>
                    {typingConversationId === activeConversation.id ? "печатает..." : formatPresence(activeConversation.participant)}
                  </div>
                </div>
                  </div>
                  <div ref={chatMenuRef} className="relative z-[90] flex items-center gap-1 text-[var(--muted)]">
                <button
                  type="button"
                  onClick={() => {
                    setChatSearchOpen((value) => !value);
                    setChatMenuOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/[0.05] hover:text-[var(--text)]"
                  aria-label="Поиск по диалогу"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M10.5 17a6.5 6.5 0 1 1 4.6-1.9L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatMenuOpen((value) => !value);
                    setChatSearchOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/[0.05] hover:text-[var(--text)]"
                  aria-label="Меню диалога"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="M12 7.2h.01M12 12h.01M12 16.8h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {chatMenuOpen ? (
                  <div className="absolute right-0 top-11 z-[1000] w-60 overflow-hidden rounded-[18px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black)] p-1 text-sm shadow-[0_24px_70px_-32px_rgba(0,0,0,0.95)]">
                    <Link
                      href={`/profile/${activeConversation.participant.handle}`}
                      className="block rounded-[14px] px-3 py-2.5 text-[var(--text)] hover:bg-white/[0.05]"
                      onClick={() => setChatMenuOpen(false)}
                    >
                      Открыть профиль
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setChatSearchOpen(true);
                        setChatMenuOpen(false);
                      }}
                      className="block w-full rounded-[14px] px-3 py-2.5 text-left text-[var(--text)] hover:bg-white/[0.05]"
                    >
                      Найти в диалоге
                    </button>
                    <Link
                      href="/messages"
                      className="block rounded-[14px] px-3 py-2.5 text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"
                      onClick={() => setChatMenuOpen(false)}
                    >
                      Закрыть диалог
                    </Link>
                  </div>
                ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8">
              {visibleMessages.length ? (
                <div className="mx-auto grid max-w-[980px] gap-2">
                  {visibleMessages.map((message, index) => {
                    const own = message.senderId === viewerId;
                    const previous = visibleMessages[index - 1];
                    const showDate = !previous || getMessageDateKey(previous.createdAt) !== getMessageDateKey(message.createdAt);
                    const mediaPaths = message.mediaPaths.length ? message.mediaPaths : message.imagePath ? [message.imagePath] : [];
                    const isMediaGroup = mediaPaths.length > 1;

                    return (
                      <div key={message.id} className="grid gap-2">
                        {showDate ? (
                          <div className="my-2 justify-self-center rounded-full border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel-soft)_82%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--muted)] backdrop-blur">
                            {formatMessageDate(message.createdAt)}
                          </div>
                        ) : null}
                        <div className={joinClasses("flex", own ? "justify-end" : "justify-start")}>
                          <div
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setContextMenu({ x: event.clientX, y: event.clientY, message });
                            }}
                            className={joinClasses(
                              "max-w-[86%] cursor-context-menu rounded-[20px] shadow-[0_16px_28px_-24px_rgba(0,0,0,0.9)] sm:max-w-[66%]",
                              mediaPaths.length
                                ? "overflow-hidden p-0"
                                : "border px-4 py-2.5",
                              own
                                ? mediaPaths.length
                                  ? "rounded-br-md"
                                  : "rounded-br-md border-[var(--accent)]/28 bg-[color:color-mix(in_srgb,var(--accent)_22%,var(--panel-soft))]"
                                : mediaPaths.length
                                  ? "rounded-bl-md"
                                  : "rounded-bl-md border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel-soft)_92%,black)]",
                              isMediaGroup ? "w-[min(420px,76vw)]" : "",
                            )}
                          >
                            {!own ? (
                              <div className="mb-0.5 text-xs font-semibold text-[var(--accent)]">{message.sender.name}</div>
                            ) : null}
                            {message.forwardedFrom ? (
                              <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--accent)]">
                                Переслано от {message.forwardedFrom.senderName}
                              </div>
                            ) : null}
                            {message.replyTo ? (
                              <div className="mb-2 rounded-[14px] border-l-2 border-[var(--accent)] bg-black/15 px-3 py-2 text-xs text-[var(--muted)]">
                                <div className="font-semibold text-[var(--accent)]">{message.replyTo.senderName}</div>
                                <div className="mt-1 line-clamp-2">
                                  {message.replyTo.deleted
                                    ? "Сообщение удалено"
                                    : message.replyTo.content || getMessageMediaLabel(message.replyTo.imagePath) || "Сообщение"}
                                </div>
                              </div>
                            ) : null}
                            {message.deletedForAll ? (
                              <p className="text-sm italic text-[var(--muted)]">Сообщение удалено</p>
                            ) : isMediaGroup ? (
                              <div className={joinClasses("grid gap-1 overflow-hidden rounded-[20px]", getMessageMediaGroupClass(mediaPaths.length))}>
                                {mediaPaths.map((mediaPath) => (
                                  <MessageMediaPreview
                                    key={mediaPath}
                                    src={mediaPath}
                                    grouped
                                    onOpen={() => {
                                      const index = mediaItems.findIndex((item) => item.src === mediaPath);
                                      setOpenMediaIndex(index >= 0 ? index : null);
                                    }}
                                  />
                                ))}
                              </div>
                            ) : message.imagePath ? (
                              <MessageMediaPreview
                                src={message.imagePath}
                                onOpen={() => {
                                  const index = mediaItems.findIndex((item) => item.src === message.imagePath);
                                  setOpenMediaIndex(index >= 0 ? index : null);
                                }}
                              />
                            ) : null}
                            {!message.deletedForAll && message.content ? (
                              <p className={joinClasses("whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]", message.imagePath ? "mt-2 px-3 pb-2" : "")}>
                                {message.content}
                              </p>
                            ) : null}
                            <div className={joinClasses("mt-0.5 flex justify-end gap-1 text-[11px] text-[var(--muted)]", mediaPaths.length ? "px-3 pb-2" : "")}>
                              {message.editedAt && !message.deletedForAll ? <span>изменено</span> : null}
                              <span>{formatRelativeDate(message.createdAt)}</span>
                              {own ? <span className="text-[var(--accent)]">{message.readByRecipient ? "✓✓" : "✓"}</span> : null}
                              {isMediaGroup ? <span>{mediaPaths.length} медиа</span> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={scrollRef} />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-[var(--line)] text-center text-sm text-[var(--muted)]">
                  Диалог открыт. Напишите первое сообщение.
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_78%,black)] px-4 py-3 backdrop-blur">
              <div className="mx-auto grid max-w-[980px] gap-2">
                {replyTarget || editingMessage ? (
                  <div className="flex items-start justify-between gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--muted)]">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--accent)]">
                        {editingMessage ? "Изменение сообщения" : `Ответ ${replyTarget?.sender.name ?? ""}`}
                      </div>
                      <div className="mt-1 truncate">
                        {(editingMessage ?? replyTarget)?.content ||
                          getMessageMediaLabel((editingMessage ?? replyTarget)?.imagePath) ||
                          "Сообщение"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTarget(null);
                        setEditingMessage(null);
                        if (editingMessage) {
                          setMessageText("");
                        }
                      }}
                      className="rounded-full px-2 py-1 hover:bg-white/[0.04] hover:text-[var(--text)]"
                    >
                      Отмена
                    </button>
                  </div>
                ) : null}
                {messageFiles.length ? (
                  <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel-soft)] p-2">
                    <div className="mb-2 flex items-center justify-between gap-3 px-1 text-xs text-[var(--muted)]">
                      <span>{messageFiles.length === 1 ? "Вложение к сообщению" : `Вложения: ${messageFiles.length}`}</span>
                      <button
                        type="button"
                        onClick={() => setMessageFiles([])}
                        className="rounded-full px-2 py-1 hover:bg-white/[0.04] hover:text-[var(--text)]"
                      >
                        Убрать
                      </button>
                    </div>
                    <div className="flex max-h-[156px] gap-2 overflow-x-auto pb-1">
                      {messageFilePreviews.map((preview) => {
                        const isVideo = preview.type.startsWith("video/");
                        const isPreviewableImage = preview.type.startsWith("image/") && preview.type !== "image/heic" && preview.type !== "image/heif";

                        return (
                          <div key={preview.url} className="relative h-32 w-32 shrink-0 overflow-hidden rounded-[16px] border border-[var(--line)] bg-black/30 sm:h-36 sm:w-36">
                            {isVideo ? (
                              <video src={preview.url} className="h-full w-full object-cover" muted />
                            ) : isPreviewableImage ? (
                              <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-[color:color-mix(in_srgb,var(--accent)_12%,black)] p-4 text-center text-xs font-semibold text-[var(--muted)]">
                                Файл будет отправлен
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-8">
                              <div className="truncate text-[11px] font-semibold text-white/90">{preview.name}</div>
                            </div>
                            {isVideo ? (
                              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
                                video
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] transition hover:bg-white/[0.04] hover:text-[var(--text)]">
                    <span className="sr-only">Прикрепить файл</span>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="m8.5 12.5 5.9-5.9a3 3 0 1 1 4.2 4.2l-7.4 7.4a5 5 0 0 1-7.1-7.1l7.8-7.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <input
                      type="file"
                      multiple
                      disabled={Boolean(editingMessage)}
                      accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
                      onChange={(event) => setMessageFiles(Array.from(event.target.files ?? []))}
                      className="hidden"
                    />
                  </label>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Сообщение</span>
                    <input
                      type="text"
                      maxLength={2000}
                      value={messageText}
                      onChange={(event) => updateMessageText(event.target.value)}
                      placeholder={messageFiles.length ? "Подпись к файлам..." : "Сообщение..."}
                      className="h-11 w-full rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 text-sm outline-none transition focus:border-[var(--accent)]/70"
                    />
                  </label>
                <button
                  type="submit"
                  disabled={pendingMessage || (!messageText.trim() && !messageFiles.length)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--page)] shadow-[0_18px_34px_-18px_rgba(132,184,44,0.95)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Отправить сообщение"
                >
                  {pendingMessage ? (
                    <span className="text-sm font-semibold">...</span>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                      <path d="M4.5 19.5 20 12 4.5 4.5l2 6.2L13 12l-6.5 1.3-2 6.2Z" fill="currentColor" />
                    </svg>
                  )}
                </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Выберите диалог</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                Здесь будут личные сообщения один-на-один. Найдите пользователя или откройте существующий диалог.
              </p>
            </div>
          </div>
        )}
      </section>

      {error ? (
        <div className="xl:col-span-2 rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      {contextMenu ? (
        <div
          className="fixed z-[999] w-56 overflow-hidden rounded-[18px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black)] p-1 text-sm text-[var(--text)] shadow-[0_24px_70px_-32px_rgba(0,0,0,0.95)]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 240),
            top: Math.min(contextMenu.y, window.innerHeight - 300),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <MessageContextButton onClick={() => startReply(contextMenu.message)} disabled={contextMenu.message.deletedForAll}>
            Ответить
          </MessageContextButton>
          <MessageContextButton
            onClick={() => {
              setForwardingMessage(contextMenu.message);
              setContextMenu(null);
            }}
            disabled={contextMenu.message.deletedForAll}
          >
            Переслать
          </MessageContextButton>
          <MessageContextButton
            onClick={() => startEdit(contextMenu.message)}
            disabled={
              contextMenu.message.senderId !== viewerId ||
              contextMenu.message.deletedForAll ||
              Boolean(contextMenu.message.mediaPaths.length)
            }
          >
            Изменить
          </MessageContextButton>
          <MessageContextButton
            onClick={() => {
              void copyMessageText(contextMenu.message);
              setContextMenu(null);
            }}
            disabled={!contextMenu.message.content || contextMenu.message.deletedForAll}
          >
            Копировать текст
          </MessageContextButton>
          <div className="my-1 h-px bg-[var(--line)]" />
          <MessageContextButton onClick={() => void deleteMessage(contextMenu.message, "me")}>
            Удалить у меня
          </MessageContextButton>
          <MessageContextButton
            danger
            onClick={() => void deleteMessage(contextMenu.message, "all")}
            disabled={contextMenu.message.senderId !== viewerId || contextMenu.message.deletedForAll}
          >
            Удалить у всех
          </MessageContextButton>
        </div>
      ) : null}
      {forwardingMessage ? (
        <div className="fixed inset-0 z-[94] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_30px_90px_-36px_rgba(0,0,0,0.95)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-[var(--text)]">Переслать сообщение</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">Выберите диалог, куда отправить копию сообщения.</p>
              </div>
              <button
                type="button"
                onClick={() => setForwardingMessage(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/[0.05] hover:text-[var(--text)]"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="mt-4 grid max-h-[360px] gap-2 overflow-y-auto">
              {conversations.length ? (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void forwardMessage(conversation.id)}
                    className="flex items-center gap-3 rounded-[20px] bg-[var(--panel-soft)] p-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <MessageAvatar user={conversation.participant} />
                    <div className="min-w-0">
                      <MessageAuthorLine user={conversation.participant} />
                      <div className="mt-1 truncate text-xs text-[var(--muted)]">
                        {conversation.lastMessage?.content ||
                          getMessageMediaLabel(conversation.lastMessage?.imagePath) ||
                          "Диалог создан"}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
                  Пока нет диалогов для пересылки.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
      <MessageMediaViewer
        items={mediaItems}
        currentIndex={openMediaIndex}
        onNavigate={setOpenMediaIndex}
        onClose={() => setOpenMediaIndex(null)}
      />
    </div>
  );
}

function MessageContextButton({
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={joinClasses(
        "flex w-full items-center rounded-[14px] px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "text-rose-300 hover:bg-rose-500/10" : "hover:bg-white/[0.05]",
      )}
    >
      {children}
    </button>
  );
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
    if (!enabled || typeof window === "undefined") {
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
          if (item.link) {
            window.location.href = item.link;
          }
        };
      }
    };

    const onToast = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<LiveNotificationItem>;
      const item = event.detail;

      if (!item?.id) {
        return;
      }

      setToasts((current) => [...current, item].slice(-4));
    };

    window.addEventListener("glyph:notification", onNotification as EventListener);
    window.addEventListener("glyph:toast", onToast as EventListener);
    return () => {
      window.removeEventListener("glyph:notification", onNotification as EventListener);
      window.removeEventListener("glyph:toast", onToast as EventListener);
    };
  }, [enabled, isClient, viewerId]);

  useEffect(() => {
    if (!toasts.length || typeof window === "undefined") {
      return;
    }

    const timers = toasts.map((toast, index) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 8500 + index * 450),
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
            Разрешите уведомления, и новые сообщения, лайки, подписки и посты будут всплывать прямо на экране.
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
        <div className="fixed bottom-4 left-4 right-4 z-[95] grid gap-3 sm:left-auto sm:right-6 sm:w-[360px]">
          {toasts.map((toast) => (
            toast.link ? (
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
            ) : (
              <div
                key={toast.id}
                className="rounded-[22px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_96%,black_4%)] p-4 shadow-[0_24px_60px_-35px_rgba(0,0,0,0.9)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)]">{toast.title}</div>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{toast.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                    className="rounded-full px-2 py-1 text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                  >
                    ×
                  </button>
                </div>
              </div>
            )
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
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [targetGroupSlug, setTargetGroupSlug] = useState(initialGroupSlug);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const imagePath = imageFile ? await uploadFile(imageFile, "post") : "";
          await requestJson("/api/posts", {
            content: formData.get("content"),
            imagePath,
            pollQuestion: pollEnabled ? String(formData.get("pollQuestion") || "") : "",
            pollOptions: pollEnabled ? formData.getAll("pollOption").map((option) => String(option || "")) : [],
            groupSlug: targetGroupSlug,
          });
          emitLocalToast(
            "Пост опубликован",
            targetGroupSlug ? "Запись добавлена в ленту клана." : "Запись добавлена в ленту.",
          );
          setImageFile(null);
          form.reset();
          setTargetGroupSlug(initialGroupSlug);
          setPollEnabled(false);
          setPollOptions(["", ""]);
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
            <button
              type="button"
              onClick={() => setPollEnabled((current) => !current)}
              className={joinClasses(
                "flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition",
                pollEnabled
                  ? "border-[var(--accent)]/45 bg-[var(--accent)]/10 text-[var(--accent)]"
                  : "border-[var(--line)] hover:bg-white/[0.04]",
              )}
            >
              <span>◌</span>
              <span>{pollEnabled ? "Опрос включён" : "Опрос"}</span>
            </button>
          </div>
          <button type="submit" disabled={pending} className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50 sm:w-auto">
            {pending ? "Публикуем..." : "Опубликовать"}
          </button>
        </div>

        {pollEnabled ? (
          <div className="mt-4 rounded-[22px] border border-[var(--line)] bg-[color:color-mix(in_srgb,var(--panel)_72%,transparent)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">Опрос в посте</div>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Вопрос и варианты будут прикреплены к этой публикации.</p>
              </div>
              <button
                type="button"
                disabled={pollOptions.length >= 6}
                onClick={() => setPollOptions((current) => [...current, ""])}
                className="rounded-full border border-[var(--line)] px-3 py-2 text-xs font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Добавить вариант
              </button>
            </div>
            <input name="pollQuestion" placeholder="Вопрос опроса" className={fieldClass} />
            <div className="mt-3 grid gap-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    name="pollOption"
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)),
                      )
                    }
                    placeholder={`Вариант ${index + 1}`}
                    className={fieldClass}
                  />
                  {pollOptions.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setPollOptions((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
                      aria-label="Удалить вариант"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        </div>

        {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      </form>
    );
}

export function ProfileEditor({ user, onSuccess }: { user: User; onSuccess?: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const form = event.currentTarget;
        const formData = new FormData(form);

        try {
          const coverImagePath = coverFile ? await uploadFile(coverFile, "cover") : user.coverImage || "";

          await requestJson("/api/profile", {
            name: formData.get("name"),
            bio: formData.get("bio"),
            coverImagePath,
            themePreference: user.themePreference,
          });

          emitLocalToast("Профиль обновлён", "Изменения сохранены.");
          router.refresh();
          onSuccess?.();
        } catch (value) {
          setError(value instanceof Error ? value.message : "Не удалось обновить профиль.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <label className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Имя</span>
          <input name="name" defaultValue={user.name} required placeholder="Ваше имя" className={fieldClass} />
        </label>
        <div className="grid gap-2 text-sm">
          <span className="text-[var(--muted)]">Эмодзи-аватар</span>
          <div className="flex items-center gap-3 rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel)] text-3xl">
              {user.avatar.type === "emoji" ? user.avatar.value : "✨"}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)]">Аватар профиля</div>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                Эмодзи закрепляется при регистрации и не редактируется.
              </p>
            </div>
          </div>
        </div>
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
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState("✨");

  return (
    <form
      className="grid gap-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
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

          emitLocalToast("Клан создан", "Глиф зафиксирован при создании и больше не меняется.");
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
          <span className="text-[var(--muted)]">Эмодзи клана</span>
          <EmojiPicker onSelect={setSelectedEmoji} currentEmoji={selectedEmoji} />
          <span className="text-xs text-[var(--muted)]">
            Эмодзи выбирается один раз при создании клана и потом не редактируется.
          </span>
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
          accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
          onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
          className="rounded-[18px] border border-[var(--line)] bg-[var(--panel-soft)] px-3 py-2.5 text-xs text-[var(--muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--page)]"
        />
      </label>

      {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
          {pending ? "Создаём..." : "Создать клан"}
        </button>
      </div>
    </form>
  );
}

export function ClanEditForm({ group }: { group: Group }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const currentEmoji = group.avatar.type === "emoji" ? group.avatar.value : "✨";

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-2 text-sm font-semibold text-[var(--text)] hover:bg-white/[0.04]"
      >
        Редактировать клан
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Редактировать клан">
        <form
          className="grid gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const form = event.currentTarget;
            const formData = new FormData(form);

            try {
              const coverImagePath = coverFile ? await uploadFile(coverFile, "cover") : "";
              const response = await requestJson<{ slug: string }>("/api/clans/update", {
                currentSlug: group.slug,
                name: formData.get("name"),
                slug: formData.get("slug"),
                description: formData.get("description"),
                coverImagePath,
              });

              emitLocalToast("Клан обновлён", "Изменения сохранены.");
              setCoverFile(null);
              setIsOpen(false);
              router.push(`/clan/${response.slug}`);
              router.refresh();
            } catch (value) {
              setError(value instanceof Error ? value.message : "Не удалось обновить клан.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] text-4xl">
                {currentEmoji}
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-[var(--text)]">{group.name}</div>
                <div className="mt-1 text-sm text-[var(--muted)]">@{group.slug}</div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Изменения названия, адреса, описания и обложки применяются после сохранения. Эмодзи задаётся только один раз при создании.
                </p>
              </div>
            </div>
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="text-[var(--muted)]">Название</span>
                  <input name="name" required minLength={3} maxLength={120} defaultValue={group.name} className={fieldClass} />
                </label>
                <label className="grid gap-2 text-sm">
                  <span className="text-[var(--muted)]">Slug</span>
                  <input name="slug" required minLength={3} maxLength={64} defaultValue={group.slug} className={fieldClass} />
                </label>
              </div>

              <label className="grid gap-2 text-sm">
                <span className="text-[var(--muted)]">Описание</span>
                <textarea
                  name="description"
                  rows={5}
                  required
                  minLength={12}
                  maxLength={1200}
                  defaultValue={group.description}
                  className={`${fieldClass} resize-none`}
                />
              </label>

              <label className="grid gap-2 text-sm">
                <span className="text-[var(--muted)]">Новая обложка</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
                  onChange={(event) => setCoverFile(event.target.files?.[0] || null)}
                  className="rounded-[18px] border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-xs text-[var(--muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[var(--page)]"
                />
                <span className="text-xs text-[var(--muted)]">
                  {coverFile ? `Выбрано: ${coverFile.name}` : "Если файл не выбран, текущая обложка останется."}
                </span>
              </label>
            </div>

            <div className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">Эмодзи клана</span>
              <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-[var(--line)] bg-[var(--panel-strong)] text-3xl">
                    {currentEmoji}
                  </div>
                  <div className="min-w-0">
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                      Этот эмодзи уже закреплён за кланом и не редактируется.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error ? <div className="rounded-[18px] border border-rose-500/18 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]"
            >
              Отмена
            </button>
            <button type="submit" disabled={pending} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--page)] hover:opacity-90 disabled:opacity-50">
              {pending ? "Сохраняем..." : "Сохранить клан"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
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

export function SidebarFooter() {
  const links = [
    { href: "/", label: "Главная" },
    { href: "/search", label: "Поиск" },
    { href: "https://t.me/Cl0udDev", label: "Telegram" },
    { href: "https://github.com/St1ch/glyph", label: "GitHub" },
  ] as const;

  return (
    <div className="app-footer fixed bottom-6 right-8 z-30 hidden items-end gap-2 text-right xl:flex xl:flex-col">
      <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-[var(--muted)]">
        {links.map((item, index) => (
          <div key={item.label} className="flex items-center gap-2">
            <Link
              href={item.href}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
              className="font-medium transition hover:text-[var(--text)]"
            >
              {item.label}
            </Link>
            {index < links.length - 1 ? (
              <span className="text-[9px] text-[var(--line)]">•</span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-3 text-[10px] leading-5">
        <div className="text-[color:color-mix(in_srgb,var(--muted)_86%,transparent)]">
          © 2026 GLYPH
        </div>
      </div>
    </div>
  );
}

export function ProfileSettingsModal({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="whitespace-nowrap rounded-xl bg-[var(--accent)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--page)] hover:opacity-90">
        Редактировать
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Редактировать профиль">
        <ProfileEditor user={user} onSuccess={() => setIsOpen(false)} />
      </Modal>
    </>
  );
}

export function VerificationModal({ status }: { status: VerificationStatus }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="whitespace-nowrap rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]">
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
      <button type="button" onClick={() => setIsOpen(true)} className="whitespace-nowrap rounded-xl border border-[var(--line)] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)]">
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

type FeedTab = {
  key: string;
  label: string;
  href: string;
};

export function FeedTabs({
  tabs,
  activeView,
}: {
  tabs: readonly FeedTab[];
  activeView: string;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastY;

      if (currentY < 24 || delta < 0) {
        setVisible(true);
      } else if (delta > 6) {
        setVisible(false);
      }

      lastY = currentY;
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={joinClasses(
        "sticky top-16 z-30 mb-6 -mx-2 px-2 pb-3 pt-1 backdrop-blur lg:top-4 transition-transform duration-200 will-change-transform",
        visible ? "translate-y-0" : "-translate-y-[calc(100%+0.75rem)]",
      )}
    >
      <div className="flex justify-center rounded-[30px] bg-[color:color-mix(in_srgb,var(--page)_82%,transparent)] py-2">
        <div className="grid w-full max-w-[520px] grid-cols-1 gap-2 rounded-[26px] border border-[var(--line)] bg-[var(--panel-strong)] p-2 shadow-[0_16px_36px_-26px_rgba(0,0,0,0.85)] sm:grid-cols-3 sm:gap-1 sm:rounded-full">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={joinClasses(
                "rounded-full px-4 py-3 text-center text-sm font-medium transition",
                activeView === tab.key
                  ? "bg-white/[0.08] text-[var(--text)]"
                  : "text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
