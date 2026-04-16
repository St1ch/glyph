export const siteConfig = {
  name: "GLYPH",
  version: "v1 beta",
  description:
    "Минималистичная социальная платформа с лентой, кланами, уведомлениями и подтверждаемыми профилями.",
  url: "https://glyph.local",
  navigation: [
    { href: "/", label: "Лента", icon: "feed" },
    { href: "/search", label: "Поиск", icon: "search" },
    { href: "/notifications", label: "Уведомления", icon: "bell" },
    { href: "/messages", label: "Сообщения · скоро", icon: "message" },
  ],
} as const;

export const uploadLimits = {
  avatar: 5 * 1024 * 1024,
  cover: 8 * 1024 * 1024,
  post: 8 * 1024 * 1024,
  verification: 50 * 1024 * 1024,
} as const;

export const verificationVideoTypes = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const adminHandles = ["cloud-dev"] as const;

export const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const formatters = {
  shortDate: new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }),
  fullDate: new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
  }),
  time: new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / (1000 * 60));

  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} дн назад`;

  return formatters.shortDate.format(date);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function isAdminHandle(handle: string) {
  return adminHandles.includes(handle as (typeof adminHandles)[number]);
}
