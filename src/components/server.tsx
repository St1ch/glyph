import Image from "next/image";
import Link from "next/link";
import type { DecoratedPost, Group, Notification, User } from "@/lib/types";
import { formatRelativeDate, formatters, joinClasses } from "@/lib/site";
import { CommentsPanel, FollowButton, JoinClanButton, LikeButton, PostActionsMenu, PostImageViewer, PostOpenFrame, RepostButton, VoteButtons } from "@/components/client";

type Viewer = User | null;

function EmbeddedPostCard({ post }: { post: DecoratedPost }) {
  const authorHref = post.author.type === "user" ? `/profile/${post.author.handle}` : `/clan/${post.author.slug}`;

  return (
    <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
      <div className="flex items-start gap-3">
        <Link href={authorHref} className="shrink-0">
          <AvatarBubble avatar={post.author.avatar} name={post.author.name} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={authorHref} className="text-sm font-semibold tracking-tight hover:opacity-75">
              {post.author.name}
            </Link>
            {post.author.type === "user" ? (
              <>
                <span className="text-xs text-[var(--muted)]">@{post.author.handle}</span>
                <VerificationBadge status={post.author.verificationStatus} />
              </>
            ) : (
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">клан</span>
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">{formatRelativeDate(post.createdAt)}</div>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {post.content ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">{post.content}</p>
        ) : null}

        {post.imagePath ? (
          <PostImageViewer
            src={post.imagePath}
            alt="Вложение к посту"
            width={1200}
            height={900}
            className="rounded-[18px]"
            maxPreviewHeightClass="max-h-[360px]"
          />
        ) : null}

        {post.poll ? (
          <div className="rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="text-sm font-semibold text-[var(--text)]">{post.poll.question}</div>
            <div className="mt-2 grid gap-2">
              {post.poll.options.map((option) => {
                const totalVotes = post.poll?.options.reduce((sum, current) => sum + current.voterIds.length, 0);
                const percent = totalVotes ? Math.round((option.voterIds.length / totalVotes) * 100) : 0;

                return (
                  <div key={option.id} className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-xs">
                    <span>{option.label}</span>
                    <span className="text-[var(--muted)]">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AvatarBubble({
  avatar,
  name,
  size = "md",
}: {
  avatar: User["avatar"] | Group["avatar"];
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "h-10 w-10 text-lg",
    md: "h-14 w-14 text-2xl",
    lg: "h-24 w-24 text-5xl",
  }[size];

  const sizePixels = {
    sm: 40,
    md: 56,
    lg: 96,
  }[size];

  if (avatar.type === "image") {
    return (
      <Image
        alt={name}
        src={avatar.value}
        width={sizePixels}
        height={sizePixels}
        className={joinClasses(
          sizeClass,
          "rounded-3xl border border-[var(--line)] object-cover shadow-sm",
        )}
      />
    );
  }

  return (
    <div
      className={joinClasses(
        sizeClass,
        "flex items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] shadow-sm",
      )}
      aria-label={name}
    >
      <span>{avatar.value}</span>
    </div>
  );
}

export function VerificationBadge({ status }: { status: User["verificationStatus"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#0f3b6c] px-2.5 py-1 text-[11px] font-semibold text-[#90c8ff]">
        <span>✦</span>
        <span>Верифицирован</span>
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/14 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
        На проверке
      </span>
    );
  }

  return null;
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] backdrop-blur sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h2>
          {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-[var(--panel-soft)] px-5 py-10 text-center">
      <div className="mx-auto max-w-md">
        <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
      </div>
    </div>
  );
}

export function PostCard({
  post,
  viewer,
  showComments = false,
}: {
  post: DecoratedPost;
  viewer: Viewer;
  showComments?: boolean;
}) {
  const authorHref = post.author.type === "user" ? `/profile/${post.author.handle}` : `/clan/${post.author.slug}`;
  const postHref = `/post/${post.id}`;

  return (
    <PostOpenFrame href={postHref}>
      <article className="rounded-[28px] border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.85)] transition hover:border-[var(--line-strong)] sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <Link href={authorHref} className="shrink-0">
          <AvatarBubble avatar={post.author.avatar} name={post.author.name} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={authorHref} className="text-sm font-semibold tracking-tight hover:opacity-75">
              {post.author.name}
            </Link>
            {post.author.type === "user" ? (
              <>
                <span className="text-xs text-[var(--muted)]">@{post.author.handle}</span>
                <VerificationBadge status={post.author.verificationStatus} />
              </>
            ) : (
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">клан</span>
            )}
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">{formatRelativeDate(post.createdAt)}</div>
        </div>

        <PostActionsMenu postId={post.id} disabledReport={!viewer} />
      </div>

      <div className="mt-4 space-y-4">
        {post.repostedPost ? (
          <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted)]">
            Репост
          </div>
        ) : null}

        {post.content ? (
          <Link href={postHref} className="block rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[var(--text)]">{post.content}</p>
          </Link>
        ) : null}

        {post.imagePath ? (
          <PostImageViewer
            src={post.imagePath}
            alt="Вложение к посту"
            width={1200}
            height={900}
            className="rounded-[22px]"
            maxPreviewHeightClass="max-h-[480px]"
          />
        ) : null}

        {post.poll ? (
          <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">{post.poll.question}</div>
            <div className="mt-3 grid gap-2">
              {post.poll.options.map((option) => {
                const totalVotes = post.poll?.options.reduce((sum, current) => sum + current.voterIds.length, 0);
                const percent = totalVotes ? Math.round((option.voterIds.length / totalVotes) * 100) : 0;
                const selected = viewer ? option.voterIds.includes(viewer.id) : false;

                return (
                  <div key={option.id} className="overflow-hidden rounded-2xl border border-[var(--line)]">
                    <div
                      className={joinClasses(
                        "flex items-center justify-between gap-3 px-4 py-3 text-sm",
                        selected ? "bg-white/[0.08]" : "bg-transparent",
                      )}
                    >
                      <span>{option.label}</span>
                      <span className="text-[var(--muted)]">{percent}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <VoteButtons post={post} disabled={!viewer} />
          </div>
        ) : null}

        {post.repostedPost ? <EmbeddedPostCard post={post.repostedPost} /> : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[var(--line)] pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--muted)]">
          <span>{post.likeCount} лайков</span>
          <span>{post.commentCount} комментариев</span>
          <span>{post.repostedPost ? "Репост" : post.poll ? "Опрос" : "Пост"}</span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link
            href={postHref}
            className="w-full rounded-full border border-[var(--line)] px-4 py-2.5 text-center text-sm font-medium text-[var(--muted)] hover:bg-white/[0.04] hover:text-[var(--text)] sm:w-auto"
          >
            💬 Обсуждение
          </Link>
          <RepostButton post={post} disabled={!viewer} />
          <LikeButton postId={post.id} liked={post.likedByViewer} likeCount={post.likeCount} disabled={!viewer} />
        </div>
      </div>

      {showComments ? (
        <div className="mt-4 grid gap-3 border-t border-[var(--line)] pt-4">
          <CommentsPanel postId={post.id} comments={post.comments} disabled={!viewer} />
        </div>
      ) : null}
      </article>
    </PostOpenFrame>
  );
}

export function UserCard({ user, viewer }: { user: User; viewer: Viewer }) {
  const isOwn = viewer?.id === user.id;
  const isFollowing = viewer ? viewer.followingIds.includes(user.id) : false;

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link href={`/profile/${user.handle}`} className="shrink-0">
          <AvatarBubble avatar={user.avatar} name={user.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${user.handle}`} className="font-semibold tracking-tight hover:opacity-75">
              {user.name}
            </Link>
            <VerificationBadge status={user.verificationStatus} />
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">@{user.handle}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{user.bio}</p>
          <div className="mt-3 text-xs text-[var(--muted)]">
            {user.followerIds.length} подписчиков · {user.followingIds.length} подписок
          </div>
        </div>
        {!isOwn ? <FollowButton handle={user.handle} isFollowing={isFollowing} disabled={!viewer} /> : null}
      </div>
    </div>
  );
}

export function ClanCard({ group, viewer }: { group: Group; viewer: Viewer }) {
  const joined = viewer ? group.memberIds.includes(viewer.id) : false;

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link href={`/clan/${group.slug}`} className="shrink-0">
          <AvatarBubble avatar={group.avatar} name={group.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/clan/${group.slug}`} className="font-semibold tracking-tight hover:opacity-75">
            {group.name}
          </Link>
          <div className="mt-1 text-sm text-[var(--muted)]">@{group.slug}</div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{group.description}</p>
          <div className="mt-3 text-xs text-[var(--muted)]">
            {group.memberIds.length} участников · создан {formatters.shortDate.format(new Date(group.createdAt))}
          </div>
        </div>
        <JoinClanButton slug={group.slug} joined={joined} disabled={!viewer} />
      </div>
    </div>
  );
}

export function NotificationList({ items }: { items: Notification[] }) {
  if (!items.length) {
    return (
      <EmptyState
        title="Пока пусто"
        description="Когда кто-то подпишется, поставит лайк или система пришлёт важное обновление, всё появится здесь."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.link}
          className="rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-semibold tracking-tight">{item.title}</div>
            <div className="text-xs text-[var(--muted)]">{formatRelativeDate(item.createdAt)}</div>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{item.description}</p>
        </Link>
      ))}
    </div>
  );
}
