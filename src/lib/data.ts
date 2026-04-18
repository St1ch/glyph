import "server-only";

import { compare, hashSync } from "bcryptjs";
import { cookies } from "next/headers";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import heicConvert from "heic-convert";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type {
  AdminPostReport,
  AdminVerificationRequest,
  DecoratedPostComment,
  DecoratedPost,
  Group,
  MailPreview,
  Notification,
  PostReport,
  PostReportCategory,
  User,
  VerificationRequest,
} from "@/lib/types";
import { formatRelativeDate, getBaseUrl, isAdminHandle, slugify } from "@/lib/site";
import {
  execute,
  placeholders,
  queryOne,
  queryRows,
  type SqlValue,
  txExecute,
  txQueryOne,
  txQueryRows,
  withTransaction,
} from "@/lib/mysql";
import { isMailConfigured, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/mail";
import { emitRealtimeEvent, queueRealtimeEvent } from "@/lib/realtime";

const storageDir = path.join(process.cwd(), "storage");
const uploadsDir = path.join(storageDir, "uploads");

const sessionCookieName = "glyph_session";
const sessionTtlDays = 30;

type RegisterInput = {
  name: string;
  handle: string;
  email: string;
  password: string;
};

type LoginInput = {
  login: string;
  password: string;
};

type ProfileUpdateInput = {
  name: string;
  bio: string;
  avatarEmoji: string;
  coverImagePath: string;
  themePreference: User["themePreference"];
};

type AccountSettingsInput = {
  themePreference: User["themePreference"];
  notificationsEnabled: boolean;
  privateProfile: boolean;
};

type CreatePostInput = {
  userId: string;
  content: string;
  imagePath: string;
  pollQuestion: string;
  pollOptions: string[];
  repostOfPostId: string | null;
  groupSlug: string | null;
};

type VerificationInput = {
  userId: string;
  reason: string;
  consent: boolean;
  videoPath: string;
};

type CreateClanInput = {
  userId: string;
  name: string;
  slug: string;
  description: string;
  avatarEmoji: string;
  coverImagePath: string;
};

type UserRow = RowDataPacket & {
  id: string;
  handle: string;
  name: string;
  email: string;
  password_hash: string;
  bio: string;
  avatar_type: "emoji" | "image";
  avatar_value: string;
  cover_image: string | null;
  created_at: Date | string;
  verified_email_at: Date | string | null;
  theme_preference: User["themePreference"];
  notifications_enabled: number;
  private_profile: number;
  verification_status: User["verificationStatus"];
};

type GroupRow = RowDataPacket & {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar_type: "emoji" | "image";
  avatar_value: string;
  cover_image: string | null;
  created_at: Date | string;
};

type PostRow = RowDataPacket & {
  id: string;
  author_type: "user" | "group";
  author_id: string;
  content: string;
  image_path: string | null;
  repost_of_post_id: string | null;
  created_at: Date | string;
};

type PollRow = RowDataPacket & {
  id: string;
  post_id: string;
  question: string;
};

type PollOptionRow = RowDataPacket & {
  id: string;
  poll_id: string;
  label: string;
};

type VoteRow = RowDataPacket & {
  option_id: string;
  user_id: string;
};

type LikeRow = RowDataPacket & {
  post_id: string;
  user_id: string;
};

type CommentRow = RowDataPacket & {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  image_path: string | null;
  parent_comment_id: string | null;
  created_at: Date | string;
};

type FollowRow = RowDataPacket & {
  follower_user_id: string;
  following_user_id: string;
};

type NotificationRow = RowDataPacket & {
  id: string;
  user_id: string;
  title: string;
  description: string;
  link: string;
  created_at: Date | string;
  is_read: number;
};

type SessionRow = RowDataPacket & {
  token: string;
  user_id: string;
  expires_at: Date | string;
};

type VerificationTokenRow = RowDataPacket & {
  token: string;
  user_id: string;
  email: string;
  expires_at: Date | string;
  created_at: Date | string;
};

type PasswordResetTokenRow = RowDataPacket & {
  token: string;
  user_id: string;
  expires_at: Date | string;
  created_at: Date | string;
  used_at: Date | string | null;
};

type VerificationRequestRow = RowDataPacket & {
  id: string;
  user_id: string;
  reason: string;
  consent: number;
  video_path: string;
  submitted_at: Date | string;
  status: VerificationRequest["status"];
};

type PostReportRow = RowDataPacket & {
  id: string;
  post_id: string;
  reporter_user_id: string;
  category: PostReportCategory;
  details: string | null;
  status: PostReport["status"];
  created_at: Date | string;
  reviewed_at: Date | string | null;
};

type MailPreviewRow = RowDataPacket & {
  id: string;
  email_to: string;
  subject: string;
  link: string;
  created_at: Date | string;
};

type DecoratedAuthor = DecoratedPost["author"];
type DecoratedCommentAuthor = DecoratedPostComment["author"];
type CountRow = RowDataPacket & {
  count: number;
};

let postReportsDetailsColumnPromise: Promise<boolean> | null = null;

async function hasPostReportDetailsColumn() {
  if (!postReportsDetailsColumnPromise) {
    postReportsDetailsColumnPromise = queryOne<CountRow>(
      `SELECT COUNT(*) AS count
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'post_reports'
         AND COLUMN_NAME = 'details'`,
    )
      .then((row) => Number(row?.count ?? 0) > 0)
      .catch(() => false);
  }

  return postReportsDetailsColumnPromise;
}

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function mapUser(row: UserRow, relations?: {
  followerIds?: string[];
  followingIds?: string[];
  likedPostIds?: string[];
}): User {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    bio: row.bio,
    avatar: {
      type: row.avatar_type,
      value: row.avatar_value,
    },
    coverImage: row.cover_image,
    createdAt: toIso(row.created_at)!,
    verifiedEmailAt: toIso(row.verified_email_at),
      followerIds: relations?.followerIds ?? [],
      followingIds: relations?.followingIds ?? [],
      likedPostIds: relations?.likedPostIds ?? [],
      themePreference: row.theme_preference,
      notificationsEnabled: Boolean(row.notifications_enabled),
      privateProfile: Boolean(row.private_profile),
      verificationStatus: row.verification_status,
      isAdmin: isAdminHandle(row.handle),
    };
  }

function mapGroup(row: GroupRow, memberIds: string[] = []): Group {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    avatar: {
      type: row.avatar_type,
      value: row.avatar_value,
    },
    coverImage: row.cover_image,
    memberIds,
    createdAt: toIso(row.created_at)!,
  };
}

function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: toIso(row.created_at)!,
    read: Boolean(row.is_read),
  };
}

function mapVerificationRequest(row: VerificationRequestRow): VerificationRequest {
  return {
    id: row.id,
    userId: row.user_id,
    reason: row.reason,
    consent: Boolean(row.consent),
    videoPath: row.video_path,
    submittedAt: toIso(row.submitted_at)!,
    status: row.status,
  };
}

function mapPostReport(row: PostReportRow): PostReport {
  return {
    id: row.id,
    postId: row.post_id,
    reporterUserId: row.reporter_user_id,
    category: row.category,
    details: row.details,
    status: row.status,
    createdAt: toIso(row.created_at)!,
    reviewedAt: toIso(row.reviewed_at),
  };
}

function getReportCategoryLabel(category: PostReportCategory) {
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

function mapMailPreview(row: MailPreviewRow): MailPreview {
  return {
    id: row.id,
    to: row.email_to,
    subject: row.subject,
    link: row.link,
    createdAt: toIso(row.created_at)!,
  };
}

function buildNotification(userId: string, title: string, description: string, link: string): Notification {
  return {
    id: randomUUID(),
    userId,
    title,
    description,
    link,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

function assertAdmin(user: User | null): asserts user is User {
  if (!user || !user.isAdmin) {
    throw new Error("Недостаточно прав для доступа в админку.");
  }
}

function canAccessPrivateProfile(viewer: User | null, user: User) {
  if (!user.privateProfile) {
    return true;
  }

  if (!viewer) {
    return false;
  }

  if (viewer.id === user.id || viewer.isAdmin) {
    return true;
  }

  return viewer.followingIds.includes(user.id);
}

async function collectPostCascadeIds(connection: PoolConnection, seedPostIds: string[]) {
  const idsToDelete = new Set<string>(seedPostIds);
  let frontier = [...seedPostIds];

  while (frontier.length) {
    const rows = await txQueryRows<PostRow>(
      connection,
      `SELECT * FROM posts WHERE repost_of_post_id IN (${placeholders(frontier)})`,
      frontier,
    );

    const nextFrontier: string[] = [];

    for (const row of rows) {
      if (!idsToDelete.has(row.id)) {
        idsToDelete.add(row.id);
        nextFrontier.push(row.id);
      }
    }

    frontier = nextFrontier;
  }

  return [...idsToDelete];
}

async function getFollowRelations(userId: string) {
  const [followers, following] = await Promise.all([
    queryRows<FollowRow>(`SELECT follower_user_id, following_user_id FROM follows WHERE following_user_id = ?`, [userId]),
    queryRows<FollowRow>(`SELECT follower_user_id, following_user_id FROM follows WHERE follower_user_id = ?`, [userId]),
  ]);

  return {
    followerIds: followers.map((row) => row.follower_user_id),
    followingIds: following.map((row) => row.following_user_id),
  };
}

async function getLikedPostIds(userId: string) {
  const rows = await queryRows<LikeRow>(`SELECT post_id, user_id FROM post_likes WHERE user_id = ?`, [userId]);
  return rows.map((row) => row.post_id);
}

async function getViewerMemberGroups(userId: string) {
  const rows = await queryRows<GroupRow>(
    `SELECT gc.*
     FROM groups_clans gc
     INNER JOIN group_members gm ON gm.group_id = gc.id
     WHERE gm.user_id = ?
     ORDER BY gc.created_at DESC`,
    [userId],
  );

  return getGroupsWithMembers(rows);
}

async function getFullUserById(userId: string) {
  const row = await queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [userId]);

  if (!row) {
    return null;
  }

  const [relations, likedPostIds] = await Promise.all([
    getFollowRelations(userId),
    getLikedPostIds(userId),
  ]);

  return mapUser(row, { ...relations, likedPostIds });
}

async function getFullUserByHandle(handle: string) {
  const row = await queryOne<UserRow>(`SELECT * FROM users WHERE handle = ?`, [handle]);
  return row ? getFullUserById(row.id) : null;
}

async function getDecoratedPosts(whereSql: string, params: SqlValue[], viewerId?: string | null): Promise<DecoratedPost[]> {
  const posts = await queryRows<PostRow>(`SELECT * FROM posts ${whereSql} ORDER BY created_at DESC`, params);

  if (!posts.length) {
    return [];
  }

  const repostIds = [...new Set(posts.map((post) => post.repost_of_post_id).filter(Boolean))] as string[];
  const repostedPosts = repostIds.length
    ? await queryRows<PostRow>(`SELECT * FROM posts WHERE id IN (${placeholders(repostIds)})`, repostIds)
    : [];

  const allPosts = [...posts, ...repostedPosts.filter((row) => !posts.some((post) => post.id === row.id))];
  const postIds = allPosts.map((post) => post.id);
  const postPlaceholders = placeholders(postIds);
  const hasReportDetails = await hasPostReportDetailsColumn();

  const [likes, polls, options, comments, reportRows] = await Promise.all([
    queryRows<LikeRow>(`SELECT post_id, user_id FROM post_likes WHERE post_id IN (${postPlaceholders})`, postIds),
    queryRows<PollRow>(`SELECT id, post_id, question FROM polls WHERE post_id IN (${postPlaceholders})`, postIds),
    queryRows<PollOptionRow>(
      `SELECT po.id, po.poll_id, po.label
       FROM poll_options po
       INNER JOIN polls p ON p.id = po.poll_id
       WHERE p.post_id IN (${postPlaceholders})`,
      postIds,
    ),
    queryRows<CommentRow>(
      `SELECT id, post_id, user_id, content, image_path, parent_comment_id, created_at
       FROM comments
      WHERE post_id IN (${postPlaceholders})
       ORDER BY created_at ASC`,
      postIds,
    ),
    queryRows<PostReportRow>(
      `SELECT id, post_id, reporter_user_id, category, ${hasReportDetails ? "details" : "NULL AS details"}, status, created_at, reviewed_at
       FROM post_reports
       WHERE post_id IN (${postPlaceholders})`,
      postIds,
    ),
  ]);

  const pollIds = polls.map((poll) => poll.id);
  const votes = pollIds.length
    ? await queryRows<VoteRow>(
        `SELECT pv.option_id, pv.user_id
         FROM poll_votes pv
         WHERE pv.option_id IN (${placeholders(pollIds)})`,
        pollIds,
      )
    : [];

  const userAuthorIds = [
    ...new Set([
      ...allPosts.filter((post) => post.author_type === "user").map((post) => post.author_id),
      ...comments.map((comment) => comment.user_id),
    ]),
  ];
  const groupAuthorIds = [...new Set(allPosts.filter((post) => post.author_type === "group").map((post) => post.author_id))];

  const [userAuthors, groupAuthors] = await Promise.all([
    userAuthorIds.length
      ? queryRows<UserRow>(`SELECT * FROM users WHERE id IN (${placeholders(userAuthorIds)})`, userAuthorIds)
      : Promise.resolve([]),
    groupAuthorIds.length
      ? queryRows<GroupRow>(`SELECT * FROM groups_clans WHERE id IN (${placeholders(groupAuthorIds)})`, groupAuthorIds)
      : Promise.resolve([]),
  ]);

  const viewerRow =
    viewerId && !userAuthors.some((row) => row.id === viewerId)
      ? await queryOne<UserRow>(`SELECT * FROM users WHERE id = ?`, [viewerId])
      : userAuthors.find((row) => row.id === viewerId) ?? null;
  const viewerIsAdmin = Boolean(viewerRow && isAdminHandle(viewerRow.handle));
  const privateAuthorIds = [...new Set(
    userAuthors
      .filter((row) => row.private_profile)
      .map((row) => row.id),
  )];
  const accessiblePrivateAuthorIds = viewerId && privateAuthorIds.length
    ? new Set(
        (
          await queryRows<FollowRow>(
            `SELECT follower_user_id, following_user_id
             FROM follows
             WHERE follower_user_id = ? AND following_user_id IN (${placeholders(privateAuthorIds)})`,
            [viewerId, ...privateAuthorIds],
          )
        ).map((row) => row.following_user_id),
      )
    : new Set<string>();

  const userMap = new Map(userAuthors.map((row) => [row.id, row]));
  const groupMap = new Map(groupAuthors.map((row) => [row.id, row]));
  const likeMap = new Map<string, string[]>();
  const pollMap = new Map(polls.map((poll) => [poll.post_id, poll]));
  const optionMap = new Map<string, PollOptionRow[]>();
  const voteMap = new Map<string, string[]>();
  const commentMap = new Map<string, DecoratedPostComment[]>();
  const reportCountMap = new Map<string, number>();

  for (const like of likes) {
    likeMap.set(like.post_id, [...(likeMap.get(like.post_id) ?? []), like.user_id]);
  }

  for (const option of options) {
    optionMap.set(option.poll_id, [...(optionMap.get(option.poll_id) ?? []), option]);
  }

  for (const vote of votes) {
    voteMap.set(vote.option_id, [...(voteMap.get(vote.option_id) ?? []), vote.user_id]);
  }

  for (const report of reportRows) {
    reportCountMap.set(report.post_id, (reportCountMap.get(report.post_id) ?? 0) + 1);
  }

  for (const comment of comments) {
    const row = userMap.get(comment.user_id);

    if (!row) {
      continue;
    }

    const author: DecoratedCommentAuthor = {
      handle: row.handle,
      name: row.name,
      avatar: { type: row.avatar_type, value: row.avatar_value },
      verificationStatus: row.verification_status,
    };

    commentMap.set(comment.post_id, [
      ...(commentMap.get(comment.post_id) ?? []),
        {
          id: comment.id,
          postId: comment.post_id,
          authorId: comment.user_id,
          content: comment.content,
          imagePath: comment.image_path,
          parentCommentId: comment.parent_comment_id,
          createdAt: toIso(comment.created_at)!,
          author,
        },
      ]);
  }

  const decoratedMap = new Map<string, DecoratedPost>();

  for (const post of allPosts) {
    const likeUserIds = likeMap.get(post.id) ?? [];
    const poll = pollMap.get(post.id);
    let author: DecoratedAuthor;

    if (post.author_type === "user") {
      const row = userMap.get(post.author_id);

      if (!row) {
        throw new Error("Автор поста не найден");
      }

       if (
        row.private_profile &&
        !viewerIsAdmin &&
        viewerId !== row.id &&
        !accessiblePrivateAuthorIds.has(row.id)
      ) {
        continue;
      }

      author = {
        type: "user",
        handle: row.handle,
        name: row.name,
        avatar: { type: row.avatar_type, value: row.avatar_value },
        verificationStatus: row.verification_status,
      };
    } else {
      const row = groupMap.get(post.author_id);

      if (!row) {
        throw new Error("Клан поста не найден");
      }

      author = {
        type: "group",
        slug: row.slug,
        name: row.name,
        avatar: { type: row.avatar_type, value: row.avatar_value },
      };
    }

    decoratedMap.set(post.id, {
      id: post.id,
      authorType: post.author_type,
      authorId: post.author_id,
      content: post.content,
      imagePath: post.image_path,
      poll: poll
        ? {
            question: poll.question,
            options: (optionMap.get(poll.id) ?? []).map((option) => ({
              id: option.id,
              label: option.label,
              voterIds: voteMap.get(option.id) ?? [],
            })),
          }
        : null,
      repostOfPostId: post.repost_of_post_id,
      repostedPost: null,
      createdAt: toIso(post.created_at)!,
      likeUserIds,
      author,
      likeCount: likeUserIds.length,
      commentCount: (commentMap.get(post.id) ?? []).length,
      reportCount: reportCountMap.get(post.id) ?? 0,
      likedByViewer: viewerId ? likeUserIds.includes(viewerId) : false,
      comments: commentMap.get(post.id) ?? [],
    });
  }

  for (const post of allPosts) {
    const decorated = decoratedMap.get(post.id);

    if (decorated && post.repost_of_post_id) {
      decorated.repostedPost = decoratedMap.get(post.repost_of_post_id) ?? null;
    }
  }

  return posts.map((post) => decoratedMap.get(post.id)!).filter(Boolean);
}

async function insertNotification(
  connection: PoolConnection,
  notification: Notification,
  options?: { force?: boolean },
) {
  if (!options?.force) {
    const recipient = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [notification.userId]);

    if (!recipient || !recipient.notifications_enabled) {
      return;
    }
  }

  await txExecute(
    connection,
    `INSERT INTO notifications (id, user_id, title, description, link, created_at, is_read)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.id,
      notification.userId,
      notification.title,
      notification.description,
      notification.link,
      new Date(notification.createdAt),
      notification.read ? 1 : 0,
    ],
  );

  queueRealtimeEvent(connection, {
    type: "notification:new",
    recipients: [notification.userId],
    payload: {
      item: notification,
    },
  });
}

async function getSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(sessionCookieName)?.value ?? null;
}

export async function getViewer() {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  await execute(`DELETE FROM sessions WHERE expires_at <= NOW(3)`);

  const session = await queryOne<SessionRow>(
    `SELECT token, user_id, expires_at FROM sessions WHERE token = ? AND expires_at > NOW(3)`,
    [token],
  );

  if (!session) {
    return null;
  }

  const viewer = await getFullUserById(session.user_id);

  if (!viewer) {
    await destroySession(token);
    return null;
  }

  return viewer;
}

export async function getAppData() {
  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const [suggestedGroupsRows, suggestedPeopleRows, feed, viewerGroups] = await Promise.all([
    queryRows<GroupRow>(`SELECT * FROM groups_clans ORDER BY created_at DESC LIMIT 2`),
    queryRows<UserRow>(
      viewerId
        ? `SELECT * FROM users WHERE id <> ? ORDER BY created_at DESC LIMIT 3`
        : `SELECT * FROM users ORDER BY created_at DESC LIMIT 3`,
      viewerId ? [viewerId] : [],
    ),
    getDecoratedPosts("", [], viewerId),
    viewerId ? getViewerMemberGroups(viewerId) : Promise.resolve([] as Group[]),
  ]);

  const suggestedGroups = await Promise.all(
    suggestedGroupsRows.map(async (row) => {
      const members = await queryRows<RowDataPacket & { user_id: string }>(
        `SELECT user_id FROM group_members WHERE group_id = ?`,
        [row.id],
      );

      return mapGroup(row, members.map((entry) => entry.user_id));
    }),
  );

  const suggestedPeople = await Promise.all(suggestedPeopleRows.map((row) => getFullUserById(row.id))) as User[];

  return {
    viewer,
    suggestedGroups,
    suggestedPeople: suggestedPeople.filter(Boolean),
    feed,
    viewerGroups,
  };
}

async function getGroupsWithMembers(rows: GroupRow[]) {
  return Promise.all(
    rows.map(async (row) => {
      const members = await queryRows<RowDataPacket & { user_id: string }>(
        `SELECT user_id FROM group_members WHERE group_id = ?`,
        [row.id],
      );

      return mapGroup(row, members.map((entry) => entry.user_id));
    }),
  );
}

export async function getPostData(postId: string) {
  const viewer = await getViewer();
  const posts = await getDecoratedPosts(`WHERE id = ?`, [postId], viewer?.id);

  return {
    viewer,
    post: posts[0] ?? null,
  };
}

export async function getSearchData(query: string) {
  const viewer = await getViewer();
  const normalized = query.trim();
  const like = `%${normalized}%`;

  const [userRows, groupRows] = await Promise.all([
    queryRows<UserRow>(
      normalized
        ? `SELECT * FROM users WHERE name LIKE ? OR handle LIKE ? OR bio LIKE ? ORDER BY created_at DESC`
        : `SELECT * FROM users ORDER BY created_at DESC`,
      normalized ? [like, like, like] : [],
    ),
    queryRows<GroupRow>(
      normalized
        ? `SELECT * FROM groups_clans WHERE name LIKE ? OR slug LIKE ? OR description LIKE ? ORDER BY created_at DESC`
        : `SELECT * FROM groups_clans ORDER BY created_at DESC`,
      normalized ? [like, like, like] : [],
    ),
  ]);

  const users = await Promise.all(userRows.map((row) => getFullUserById(row.id))) as User[];
  const groups = await getGroupsWithMembers(groupRows);

  return { viewer, users: users.filter(Boolean), groups };
}

export async function getClansDirectoryData() {
  const viewer = await getViewer();

  if (!viewer) {
    return {
      viewer: null,
      memberGroups: [] as Group[],
      discoverGroups: [] as Group[],
    };
  }

  const [memberRows, discoverRows] = await Promise.all([
    queryRows<GroupRow>(
      `SELECT gc.*
       FROM groups_clans gc
       INNER JOIN group_members gm ON gm.group_id = gc.id
       WHERE gm.user_id = ?
       ORDER BY gc.created_at DESC`,
      [viewer.id],
    ),
    queryRows<GroupRow>(
      `SELECT *
       FROM groups_clans
       WHERE id NOT IN (
         SELECT group_id FROM group_members WHERE user_id = ?
       )
       ORDER BY created_at DESC
       LIMIT 8`,
      [viewer.id],
    ),
  ]);

  const [memberGroups, discoverGroups] = await Promise.all([
    getGroupsWithMembers(memberRows),
    getGroupsWithMembers(discoverRows),
  ]);

  return {
    viewer,
    memberGroups,
    discoverGroups,
  };
}

export async function getNotificationsData() {
  const viewer = await getViewer();

  if (!viewer) {
    return { viewer: null, items: [] as Notification[] };
  }

  await execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [viewer.id]);

  const rows = await queryRows<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
    [viewer.id],
  );

  return {
    viewer,
    items: rows.map(mapNotification),
  };
}

export async function getUnreadNotificationCount(userId: string) {
  const row = await queryOne<CountRow>(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = ? AND is_read = 0`,
    [userId],
  );

  return Number(row?.count ?? 0);
}

export async function getLiveNotifications(limit = 12) {
  const viewer = await getViewer();

  if (!viewer) {
    return { viewer: null, items: [] as Notification[] };
  }

  const rows = await queryRows<NotificationRow>(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [viewer.id, limit],
  );

  return {
    viewer,
    items: rows.map(mapNotification).reverse(),
  };
}

export async function getAdminData(search = "") {
  const viewer = await getViewer();
  assertAdmin(viewer);
  const hasReportDetails = await hasPostReportDetailsColumn();

  const [requestRows, reportRows, recentPosts] = await Promise.all([
    queryRows<VerificationRequestRow>(
      `SELECT * FROM verification_requests ORDER BY submitted_at DESC`,
    ),
    queryRows<PostReportRow>(
      `SELECT id, post_id, reporter_user_id, category, ${hasReportDetails ? "details" : "NULL AS details"}, status, created_at, reviewed_at
       FROM post_reports ORDER BY
         CASE status
           WHEN 'open' THEN 0
           WHEN 'resolved' THEN 1
           ELSE 2
         END,
         created_at DESC`,
    ),
    getDecoratedPosts("", [], viewer.id),
  ]);

  const userIds = [...new Set([...requestRows.map((row) => row.user_id), ...reportRows.map((row) => row.reporter_user_id)])];
  const userRows = userIds.length
    ? await queryRows<UserRow>(`SELECT * FROM users WHERE id IN (${placeholders(userIds)})`, userIds)
    : [];
  const userMap = new Map(userRows.map((row) => [row.id, row]));

  const requests: AdminVerificationRequest[] = requestRows
    .map((row) => {
      const user = userMap.get(row.user_id);

      if (!user) {
        return null;
      }

      return {
        ...mapVerificationRequest(row),
        user: {
          id: user.id,
          handle: user.handle,
          name: user.name,
          avatar: {
            type: user.avatar_type,
            value: user.avatar_value,
          },
          verificationStatus: user.verification_status,
        },
      };
      })
      .filter(Boolean) as AdminVerificationRequest[];

  const postMap = new Map(recentPosts.map((post) => [post.id, post]));
  const reports: AdminPostReport[] = reportRows
    .map((row) => {
      const reporter = userMap.get(row.reporter_user_id);

      if (!reporter) {
        return null;
      }

      return {
        ...mapPostReport(row),
        reporter: {
          id: reporter.id,
          handle: reporter.handle,
          name: reporter.name,
          avatar: {
            type: reporter.avatar_type,
            value: reporter.avatar_value,
          },
        },
        post: postMap.get(row.post_id) ?? null,
      };
    })
    .filter(Boolean) as AdminPostReport[];

  const normalizedSearch = search.trim().toLowerCase();
  const filteredPosts = normalizedSearch
    ? recentPosts.filter((post) => {
        const authorHandle = post.author.type === "user" ? post.author.handle : post.author.slug;
        const authorName = post.author.name;
        return [post.id, post.content, authorHandle, authorName]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));
      })
    : recentPosts;

  return {
    viewer,
    requests,
    reports,
    posts: filteredPosts,
    postSearch: search,
  };
}

export async function getProfileData(handle: string, tab: string) {
  const viewer = await getViewer();
  const user = await getFullUserByHandle(handle);

  if (!user) {
    return null;
  }

  const canAccessContent = canAccessPrivateProfile(viewer, user);

  const [posts, likedPosts, verificationRequestRow] = await Promise.all([
    canAccessContent ? getDecoratedPosts(`WHERE author_type = 'user' AND author_id = ?`, [user.id], viewer?.id) : Promise.resolve([] as DecoratedPost[]),
    canAccessContent
      ? getDecoratedPosts(
          `WHERE id IN (SELECT post_id FROM post_likes WHERE user_id = ?)`,
          [user.id],
          viewer?.id,
        )
      : Promise.resolve([] as DecoratedPost[]),
    queryOne<VerificationRequestRow>(
      `SELECT * FROM verification_requests WHERE user_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`,
      [user.id],
    ),
  ]);

  return {
    viewer,
    user,
    activeTab: tab === "likes" ? "likes" : "posts",
    contentLocked: !canAccessContent,
    posts,
    likedPosts,
    verificationRequest: verificationRequestRow ? mapVerificationRequest(verificationRequestRow) : null,
  };
}

export async function getClanData(slug: string) {
  const viewer = await getViewer();
  const row = await queryOne<GroupRow>(`SELECT * FROM groups_clans WHERE slug = ?`, [slug]);

  if (!row) {
    return null;
  }

  const [memberRows, posts] = await Promise.all([
    queryRows<UserRow>(
      `SELECT u.*
       FROM users u
       INNER JOIN group_members gm ON gm.user_id = u.id
       WHERE gm.group_id = ?
       ORDER BY u.created_at DESC`,
      [row.id],
    ),
    getDecoratedPosts(`WHERE author_type = 'group' AND author_id = ?`, [row.id], viewer?.id),
  ]);

  const group = mapGroup(row, memberRows.map((entry) => entry.id));
  const members = await Promise.all(memberRows.map((entry) => getFullUserById(entry.id))) as User[];
  const viewerGroups = viewer ? await getViewerMemberGroups(viewer.id) : [];

  return {
    viewer,
    group,
    members: members.filter(Boolean),
    posts,
    viewerGroups,
  };
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const handle = slugify(input.handle || input.name);

  if (!handle) {
    throw new Error("Придумайте username для входа и профиля.");
  }

  const result = await withTransaction(async (connection) => {
    const existing = await txQueryRows<RowDataPacket & { id: string; email: string; handle: string }>(
      connection,
      `SELECT id, email, handle FROM users WHERE email = ? OR handle = ?`,
      [email, handle],
    );

    if (existing.some((entry) => entry.email === email)) {
      throw new Error("Пользователь с такой почтой уже существует.");
    }

    if (existing.some((entry) => entry.handle === handle)) {
      throw new Error("Такой username уже занят.");
    }

    const userId = randomUUID();
    const token = randomBytes(24).toString("hex");
    const link = `${getBaseUrl()}/verify-email?token=${token}`;
    const now = new Date();
    const user = {
      id: userId,
      handle,
      name: input.name.trim(),
      email,
      passwordHash: hashSync(input.password, 10),
      bio: "Новый профиль в GLYPH.",
      avatar: { type: "emoji" as const, value: "✨" },
      coverImage: null,
      createdAt: now.toISOString(),
      verifiedEmailAt: null,
      followerIds: [],
      followingIds: [],
      likedPostIds: [],
      themePreference: "system" as const,
      notificationsEnabled: true,
      privateProfile: false,
      verificationStatus: "none" as const,
      isAdmin: isAdminHandle(handle),
    };

    await txExecute(
      connection,
      `INSERT INTO users
       (id, handle, name, email, password_hash, bio, avatar_type, avatar_value, cover_image, created_at, verified_email_at, theme_preference, notifications_enabled, private_profile, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        user.id,
        user.handle,
        user.name,
        user.email,
        user.passwordHash,
        user.bio,
        user.avatar.type,
        user.avatar.value,
        null,
        now,
        null,
        user.themePreference,
        1,
        0,
        user.verificationStatus,
      ],
    );

    await txExecute(
      connection,
      `INSERT INTO verification_tokens (token, user_id, email, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [token, user.id, user.email, new Date(Date.now() + 24 * 60 * 60 * 1000), now],
    );

    await txExecute(
      connection,
      `INSERT INTO mail_previews (id, email_to, subject, link, created_at) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), user.email, "Подтвердите регистрацию в GLYPH", link, now],
    );

    return { user, verificationLink: link };
  });

  let delivery: "smtp" | "preview" = "preview";

  if (isMailConfigured()) {
    try {
      await sendVerificationEmail(result.user.email, result.verificationLink);
      delivery = "smtp";
    } catch {
      delivery = "preview";
    }
  }

  return { ...result, delivery };
}

export async function verifyEmail(token: string) {
  return withTransaction(async (connection) => {
    const verification = await txQueryOne<VerificationTokenRow>(
      connection,
      `SELECT * FROM verification_tokens WHERE token = ?`,
      [token],
    );

    if (!verification) {
      throw new Error("Ссылка подтверждения недействительна.");
    }

    if (new Date(verification.expires_at) < new Date()) {
      throw new Error("Ссылка подтверждения уже истекла.");
    }

    const userRow = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [verification.user_id]);

    if (!userRow) {
      throw new Error("Пользователь для подтверждения не найден.");
    }

    const now = new Date();
    await txExecute(connection, `UPDATE users SET verified_email_at = ? WHERE id = ?`, [now, userRow.id]);
    await txExecute(connection, `DELETE FROM verification_tokens WHERE token = ?`, [token]);
      await insertNotification(
        connection,
        buildNotification(userRow.id, "Почта подтверждена", "Теперь можно войти в аккаунт и публиковать посты.", "/auth/login"),
        { force: true },
      );

    return mapUser({ ...userRow, verified_email_at: now }, { followerIds: [], followingIds: [], likedPostIds: [] });
  });
}

export async function loginUser(input: LoginInput) {
  const normalized = input.login.trim().toLowerCase();
  const user = await queryOne<UserRow>(
    `SELECT * FROM users WHERE email = ? OR LOWER(handle) = ? LIMIT 1`,
    [normalized, normalized],
  );

  if (!user) {
    throw new Error("Аккаунт не найден.");
  }

  const matches = await compare(input.password, user.password_hash);

  if (!matches) {
    throw new Error("Неверный пароль.");
  }

  if (!user.verified_email_at) {
    const preview = await queryOne<MailPreviewRow>(
      `SELECT * FROM mail_previews WHERE email_to = ? ORDER BY created_at DESC LIMIT 1`,
      [user.email],
    );
    const detail = !isMailConfigured() && preview ? ` Проверьте письмо: ${preview.link}` : " Проверьте письмо в почте.";
    throw new Error(`Сначала подтвердите почту.${detail}`);
  }

  return mapUser(user, { ...(await getFollowRelations(user.id)), likedPostIds: await getLikedPostIds(user.id) });
}

export async function createSession(userId: string) {
  return withTransaction(async (connection) => {
    const token = randomBytes(30).toString("hex");
    await txExecute(connection, `DELETE FROM sessions WHERE user_id = ? OR expires_at <= NOW(3)`, [userId]);
    await txExecute(connection, `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`, [
      token,
      userId,
      new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000),
    ]);
    return token;
  });
}

export async function destroySession(token: string | null) {
  if (!token) {
    return;
  }

  await execute(`DELETE FROM sessions WHERE token = ?`, [token]);
}

export function getSessionCookieName() {
  return sessionCookieName;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * sessionTtlDays,
    priority: "high" as const,
  };
}

export async function createPost(input: CreatePostInput) {
  return withTransaction(async (connection) => {
    const author = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [input.userId]);

    if (!author) {
      throw new Error("Пользователь не найден.");
    }

    if (!author.verified_email_at) {
      throw new Error("Сначала подтвердите почту.");
    }

    if (!input.repostOfPostId && input.content.trim().length < 4) {
      throw new Error("Напишите хотя бы 4 символа.");
    }

    if (input.repostOfPostId) {
      const originalPost = await txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [input.repostOfPostId]);

      if (!originalPost) {
        throw new Error("Оригинальный пост для репоста не найден.");
      }
    }

    let postAuthorType: "user" | "group" = "user";
    let postAuthorId = author.id;
    let postAuthorLink = `/profile/${author.handle}`;
    let postAuthorLabel = author.name;

    if (input.groupSlug) {
      const group = await txQueryOne<GroupRow>(connection, `SELECT * FROM groups_clans WHERE slug = ?`, [input.groupSlug]);

      if (!group) {
        throw new Error("Клан для публикации не найден.");
      }

      const membership = await txQueryOne<RowDataPacket & { group_id: string; user_id: string }>(
        connection,
        `SELECT group_id, user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
        [group.id, author.id],
      );

      if (!membership) {
        throw new Error("Публиковать в этот клан могут только его участники.");
      }

      postAuthorType = "group";
      postAuthorId = group.id;
      postAuthorLink = `/clan/${group.slug}`;
      postAuthorLabel = group.name;
    }

    const postId = randomUUID();
    const now = new Date();

    await txExecute(
      connection,
      `INSERT INTO posts (id, author_type, author_id, content, image_path, repost_of_post_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [postId, postAuthorType, postAuthorId, input.content.trim(), input.imagePath || null, input.repostOfPostId, now],
    );

    if (input.pollQuestion.trim() && input.pollOptions.length > 1) {
      const pollId = randomUUID();
      await txExecute(connection, `INSERT INTO polls (id, post_id, question) VALUES (?, ?, ?)`, [pollId, postId, input.pollQuestion.trim()]);

      for (const label of input.pollOptions) {
        await txExecute(connection, `INSERT INTO poll_options (id, poll_id, label) VALUES (?, ?, ?)`, [randomUUID(), pollId, label]);
      }
    }

    if (postAuthorType === "user") {
      const followers = await txQueryRows<FollowRow>(connection, `SELECT follower_user_id, following_user_id FROM follows WHERE following_user_id = ?`, [author.id]);

      for (const follower of followers) {
        await insertNotification(
          connection,
          buildNotification(follower.follower_user_id, "Новый пост в ленте", `${author.name} опубликовал(а) новый пост.`, postAuthorLink),
        );
      }
    } else {
      const members = await txQueryRows<RowDataPacket & { user_id: string }>(
        connection,
        `SELECT user_id FROM group_members WHERE group_id = ? AND user_id <> ?`,
        [postAuthorId, author.id],
      );

      for (const member of members) {
        await insertNotification(
          connection,
          buildNotification(member.user_id, "Новый пост в клане", `В клане ${postAuthorLabel} появилась новая публикация.`, postAuthorLink),
        );
      }
    }

    if (input.repostOfPostId) {
      const originalPost = await txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [input.repostOfPostId]);

      if (originalPost?.author_type === "user" && originalPost.author_id !== author.id) {
        await insertNotification(
          connection,
          buildNotification(
            originalPost.author_id,
            "Новый репост",
            `${author.name} сделал(а) репост вашего поста.`,
            postAuthorLink,
          ),
        );
      }
    }

    queueRealtimeEvent(connection, {
      type: "feed:changed",
      payload: {
        reason: input.repostOfPostId ? "repost-created" : "post-created",
        postId,
        actorId: author.id,
      },
    });

    return { id: postId };
  });
}

export async function deletePostAsAdmin(postId: string, adminUserId: string) {
  return withTransaction(async (connection) => {
    const [admin, post] = await Promise.all([
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [adminUserId]),
      txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [postId]),
    ]);

    if (!admin || !isAdminHandle(admin.handle)) {
      throw new Error("Недостаточно прав для удаления поста.");
    }

    if (!post) {
      throw new Error("Пост не найден.");
    }

    const idsToDelete = new Set<string>([postId]);
    let frontier = [postId];

    while (frontier.length) {
      const rows = await txQueryRows<PostRow>(
        connection,
        `SELECT * FROM posts WHERE repost_of_post_id IN (${placeholders(frontier)})`,
        frontier,
      );

      const nextFrontier: string[] = [];

      for (const row of rows) {
        if (!idsToDelete.has(row.id)) {
          idsToDelete.add(row.id);
          nextFrontier.push(row.id);
        }
      }

      frontier = nextFrontier;
    }

    const deleteIds = [...idsToDelete];
    const affectedPosts = await txQueryRows<PostRow>(
      connection,
      `SELECT * FROM posts WHERE id IN (${placeholders(deleteIds)})`,
      deleteIds,
    );

    await txExecute(connection, `DELETE FROM posts WHERE id IN (${placeholders(deleteIds)})`, deleteIds);

    const affectedUserIds = [...new Set(
      affectedPosts
        .filter((entry) => entry.author_type === "user" && entry.author_id !== admin.id)
        .map((entry) => entry.author_id),
    )];

    for (const affectedUserId of affectedUserIds) {
        await insertNotification(
          connection,
          buildNotification(
            affectedUserId,
            "Пост удалён модератором",
            deleteIds.length > 1
              ? "Модерация удалила пост и связанные с ним репосты."
              : "Одна из ваших публикаций была удалена из ленты модерацией.",
            `/profile/${admin.handle}`,
          ),
          { force: true },
        );
    }

    queueRealtimeEvent(connection, {
      type: "feed:changed",
      payload: {
        reason: "post-deleted",
        postId,
        actorId: admin.id,
      },
    });

    return { ok: true };
  });
}

export async function reportPost(
  postId: string,
  reporterUserId: string,
  category: PostReportCategory,
  details: string | null = null,
) {
  const hasReportDetails = await hasPostReportDetailsColumn();

  return withTransaction(async (connection) => {
    const [post, reporter] = await Promise.all([
      txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [postId]),
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [reporterUserId]),
    ]);

    if (!post || !reporter) {
      throw new Error("Пост или пользователь не найден.");
    }

    if (post.author_type === "user" && post.author_id === reporter.id) {
      throw new Error("Нельзя пожаловаться на собственный пост.");
    }

    const existing = await txQueryOne<PostReportRow>(
      connection,
      `SELECT * FROM post_reports WHERE post_id = ? AND reporter_user_id = ?`,
      [postId, reporterUserId],
    );

    if (existing) {
      await txExecute(
        connection,
        hasReportDetails
          ? `UPDATE post_reports SET category = ?, details = ?, status = 'open', created_at = ?, reviewed_at = NULL WHERE id = ?`
          : `UPDATE post_reports SET category = ?, status = 'open', created_at = ?, reviewed_at = NULL WHERE id = ?`,
        hasReportDetails
          ? [category, details, new Date(), existing.id]
          : [category, new Date(), existing.id],
      );

      return { id: existing.id };
    }

    const reportId = randomUUID();
    await txExecute(
      connection,
      hasReportDetails
        ? `INSERT INTO post_reports (id, post_id, reporter_user_id, category, details, status, created_at, reviewed_at)
           VALUES (?, ?, ?, ?, ?, 'open', ?, NULL)`
        : `INSERT INTO post_reports (id, post_id, reporter_user_id, category, status, created_at, reviewed_at)
           VALUES (?, ?, ?, ?, 'open', ?, NULL)`,
      hasReportDetails
        ? [reportId, postId, reporterUserId, category, details, new Date()]
        : [reportId, postId, reporterUserId, category, new Date()],
    );

    const admins = await txQueryRows<UserRow>(
      connection,
      `SELECT * FROM users WHERE handle IN (${placeholders(["cloud-dev"])})`,
      ["cloud-dev"],
    );

    for (const admin of admins) {
      await insertNotification(
        connection,
        buildNotification(
          admin.id,
          "Новая жалоба на пост",
          `${reporter.name} отправил(а) жалобу категории «${getReportCategoryLabel(category)}».`,
          "/admin",
        ),
        { force: true },
      );
    }

    return { id: reportId };
  });
}

export async function reviewPostReport(
  reportId: string,
  decision: "resolved" | "dismissed",
  adminUserId: string,
) {
  return withTransaction(async (connection) => {
    const [admin, reportRow] = await Promise.all([
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [adminUserId]),
      txQueryOne<PostReportRow>(connection, `SELECT * FROM post_reports WHERE id = ?`, [reportId]),
    ]);

    if (!admin || !isAdminHandle(admin.handle)) {
      throw new Error("Недостаточно прав для модерации жалоб.");
    }

    if (!reportRow) {
      throw new Error("Жалоба не найдена.");
    }

    await txExecute(
      connection,
      `UPDATE post_reports SET status = ?, reviewed_at = ? WHERE id = ?`,
      [decision, new Date(), reportId],
    );

    return { ok: true };
  });
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
  imagePath: string | null = null,
  parentCommentId: string | null = null,
) {
  return withTransaction(async (connection) => {
    const normalizedContent = content.trim();
    const [post, author] = await Promise.all([
      txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [postId]),
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [userId]),
    ]);

    if (!post || !author) {
      throw new Error("Пост или пользователь не найден.");
    }

    if (!author.verified_email_at) {
      throw new Error("Сначала подтвердите почту.");
    }

    if (!normalizedContent && !imagePath) {
      throw new Error("Добавьте текст или изображение к комментарию.");
    }

    let parentComment: CommentRow | null = null;

    if (parentCommentId) {
      parentComment = await txQueryOne<CommentRow>(
        connection,
        `SELECT id, post_id, user_id, content, image_path, parent_comment_id, created_at FROM comments WHERE id = ?`,
        [parentCommentId],
      );

      if (!parentComment || parentComment.post_id !== post.id) {
        throw new Error("Комментарий, на который вы отвечаете, не найден.");
      }
    }

    const commentId = randomUUID();
    const now = new Date();

    await txExecute(
      connection,
      `INSERT INTO comments (id, post_id, user_id, content, image_path, parent_comment_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [commentId, post.id, author.id, normalizedContent, imagePath, parentCommentId, now],
    );

    if (post.author_type === "user" && post.author_id !== author.id) {
      await insertNotification(
        connection,
        buildNotification(
          post.author_id,
          "Новый комментарий",
          `${author.name} прокомментировал(а) ваш пост.`,
          `/post/${post.id}`,
        ),
      );
    }

    if (parentComment && parentComment.user_id !== author.id && parentComment.user_id !== post.author_id) {
      await insertNotification(
        connection,
        buildNotification(
          parentComment.user_id,
          "Ответ на комментарий",
          `${author.name} ответил(а) на ваш комментарий.`,
          `/post/${post.id}`,
        ),
      );
    }

    queueRealtimeEvent(connection, {
      type: "feed:changed",
      payload: {
        reason: "comment-created",
        postId: post.id,
        actorId: author.id,
      },
    });

    return { id: commentId };
  });
}

export async function toggleLike(postId: string, userId: string) {
  return withTransaction(async (connection) => {
    const post = await txQueryOne<PostRow>(connection, `SELECT * FROM posts WHERE id = ?`, [postId]);
    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [userId]);

    if (!post || !user) {
      throw new Error("Пост или пользователь не найден.");
    }

    const existing = await txQueryOne<LikeRow>(connection, `SELECT post_id, user_id FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    const liked = Boolean(existing);

    if (liked) {
      await txExecute(connection, `DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    } else {
      await txExecute(connection, `INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`, [postId, userId, new Date()]);

      if (post.author_type === "user" && post.author_id !== userId) {
        const author = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [post.author_id]);

        if (author) {
          await insertNotification(
            connection,
            buildNotification(author.id, "Новая реакция", `${user.name} поставил(а) лайк вашему посту.`, `/profile/${author.handle}`),
          );
        }
      }
    }

    queueRealtimeEvent(connection, {
      type: "feed:changed",
      payload: {
        reason: "post-liked",
        postId,
        actorId: user.id,
      },
    });

    return { liked: !liked };
  });
}

export async function votePost(postId: string, optionId: string, userId: string) {
  return withTransaction(async (connection) => {
    const poll = await txQueryOne<PollRow>(connection, `SELECT id, post_id, question FROM polls WHERE post_id = ?`, [postId]);

    if (!poll) {
      throw new Error("Опрос не найден.");
    }

    const option = await txQueryOne<PollOptionRow>(
      connection,
      `SELECT id, poll_id, label FROM poll_options WHERE id = ? AND poll_id = ?`,
      [optionId, poll.id],
    );

    if (!option) {
      throw new Error("Вариант ответа не найден.");
    }

    await txExecute(
      connection,
      `DELETE pv FROM poll_votes pv INNER JOIN poll_options po ON po.id = pv.option_id WHERE po.poll_id = ? AND pv.user_id = ?`,
      [poll.id, userId],
    );
    await txExecute(connection, `INSERT INTO poll_votes (option_id, user_id, created_at) VALUES (?, ?, ?)`, [optionId, userId, new Date()]);

    queueRealtimeEvent(connection, {
      type: "feed:changed",
      payload: {
        reason: "vote-cast",
        postId,
        actorId: userId,
      },
    });

    return { success: true };
  });
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  await execute(
    `UPDATE users
     SET name = ?, bio = ?, avatar_type = ?, avatar_value = ?, cover_image = ?, theme_preference = ?
     WHERE id = ?`,
    [
      input.name.trim(),
      input.bio.trim(),
      "emoji",
      input.avatarEmoji.trim(),
      input.coverImagePath || null,
      input.themePreference,
      userId,
    ],
  );

  const updated = await getFullUserById(userId);

  if (!updated) {
    throw new Error("Пользователь не найден.");
  }

  await emitRealtimeEvent({
    type: "profile:changed",
    recipients: [userId],
    payload: {
      userId,
    },
  });

  return updated;
}

export async function updateAccountSettings(userId: string, input: AccountSettingsInput) {
  await execute(
    `UPDATE users
     SET theme_preference = ?, notifications_enabled = ?, private_profile = ?
     WHERE id = ?`,
    [
      input.themePreference,
      input.notificationsEnabled ? 1 : 0,
      input.privateProfile ? 1 : 0,
      userId,
    ],
  );

  const updated = await getFullUserById(userId);

  if (!updated) {
    throw new Error("Пользователь не найден.");
  }

  await emitRealtimeEvent({
    type: "profile:changed",
    recipients: [userId],
    payload: {
      userId,
    },
  });

  return updated;
}

export async function requestPasswordResetForUser(userId: string) {
  const user = await getFullUserById(userId);

  if (!user) {
    throw new Error("Пользователь не найден.");
  }

  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const resetLink = `${getBaseUrl()}/auth/reset-password?token=${token}`;

  await withTransaction(async (connection) => {
    await txExecute(connection, `DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= NOW(3)`, [user.id]);
    await txExecute(
      connection,
      `INSERT INTO password_reset_tokens (token, user_id, expires_at, created_at, used_at)
       VALUES (?, ?, ?, ?, NULL)`,
      [token, user.id, new Date(Date.now() + 60 * 60 * 1000), now],
    );
  });

  await sendPasswordResetEmail(user.email, resetLink);

  return { ok: true };
}

export async function resetPasswordByToken(token: string, nextPassword: string) {
  return withTransaction(async (connection) => {
    const resetToken = await txQueryOne<PasswordResetTokenRow>(
      connection,
      `SELECT * FROM password_reset_tokens WHERE token = ?`,
      [token],
    );

    if (!resetToken || resetToken.used_at) {
      throw new Error("Ссылка смены пароля недействительна.");
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      throw new Error("Ссылка смены пароля уже истекла.");
    }

    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [resetToken.user_id]);

    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    await txExecute(connection, `UPDATE users SET password_hash = ? WHERE id = ?`, [hashSync(nextPassword, 10), user.id]);
    await txExecute(connection, `UPDATE password_reset_tokens SET used_at = ? WHERE token = ?`, [new Date(), token]);
    await txExecute(connection, `DELETE FROM sessions WHERE user_id = ?`, [user.id]);
  });

  return { ok: true };
}

export async function deleteAccount(userId: string) {
  return withTransaction(async (connection) => {
    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [userId]);

    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    const ownPostRows = await txQueryRows<PostRow>(
      connection,
      `SELECT * FROM posts WHERE author_type = 'user' AND author_id = ?`,
      [user.id],
    );
    const deleteIds = ownPostRows.length ? await collectPostCascadeIds(connection, ownPostRows.map((row) => row.id)) : [];

    if (deleteIds.length) {
      await txExecute(connection, `DELETE FROM posts WHERE id IN (${placeholders(deleteIds)})`, deleteIds);
    }

    await txExecute(connection, `DELETE FROM password_reset_tokens WHERE user_id = ?`, [user.id]);
    await txExecute(connection, `DELETE FROM users WHERE id = ?`, [user.id]);
  });

  await emitRealtimeEvent({
    type: "profile:changed",
    recipients: [userId],
    payload: {
      userId,
    },
  });

  return { ok: true };
}

export async function toggleFollow(targetHandle: string, viewerId: string) {
  return withTransaction(async (connection) => {
    const target = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE handle = ?`, [targetHandle]);
    const viewer = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [viewerId]);

    if (!target || !viewer) {
      throw new Error("Пользователь не найден.");
    }

    if (target.id === viewer.id) {
      throw new Error("Нельзя подписаться на самого себя.");
    }

    const existing = await txQueryOne<FollowRow>(
      connection,
      `SELECT follower_user_id, following_user_id FROM follows WHERE follower_user_id = ? AND following_user_id = ?`,
      [viewer.id, target.id],
    );
    const follows = Boolean(existing);

    if (follows) {
      await txExecute(connection, `DELETE FROM follows WHERE follower_user_id = ? AND following_user_id = ?`, [viewer.id, target.id]);
    } else {
      await txExecute(connection, `INSERT INTO follows (follower_user_id, following_user_id, created_at) VALUES (?, ?, ?)`, [viewer.id, target.id, new Date()]);
      await insertNotification(
        connection,
        buildNotification(target.id, "Новый подписчик", `${viewer.name} подписался(ась) на ваш профиль.`, `/profile/${viewer.handle}`),
      );
    }

    queueRealtimeEvent(connection, {
      type: "profile:changed",
      recipients: [viewer.id, target.id],
      payload: {
        userId: target.id,
      },
    });

    return { following: !follows };
  });
}

export async function toggleClanMembership(slug: string, userId: string) {
  return withTransaction(async (connection) => {
    const group = await txQueryOne<GroupRow>(connection, `SELECT * FROM groups_clans WHERE slug = ?`, [slug]);
    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [userId]);

    if (!group || !user) {
      throw new Error("Клан или пользователь не найден.");
    }

    const existing = await txQueryOne<RowDataPacket & { group_id: string; user_id: string }>(
      connection,
      `SELECT group_id, user_id FROM group_members WHERE group_id = ? AND user_id = ?`,
      [group.id, userId],
    );
    const isMember = Boolean(existing);

    if (isMember) {
      await txExecute(connection, `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`, [group.id, userId]);
    } else {
      await txExecute(connection, `INSERT INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)`, [group.id, userId, new Date()]);
    }

    return { joined: !isMember };
  });
}

export async function createClan(input: CreateClanInput) {
  const normalizedName = input.name.trim();
  const normalizedDescription = input.description.trim();
  const normalizedSlug = slugify(input.slug || input.name);
  const normalizedEmoji = input.avatarEmoji.trim() || "✨";
  const normalizedCoverImage = input.coverImagePath.trim();

  if (normalizedName.length < 3) {
    throw new Error("Название клана должно быть длиннее.");
  }

  if (normalizedDescription.length < 12) {
    throw new Error("Добавьте более подробное описание клана.");
  }

  if (!normalizedSlug || normalizedSlug.length < 3) {
    throw new Error("Придумайте понятный slug для адреса клана.");
  }

  return withTransaction(async (connection) => {
    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [input.userId]);

    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    if (!user.verified_email_at) {
      throw new Error("Сначала подтвердите почту, а потом создавайте клан.");
    }

    const existing = await txQueryOne<GroupRow>(connection, `SELECT * FROM groups_clans WHERE slug = ?`, [normalizedSlug]);

    if (existing) {
      throw new Error("Такой адрес клана уже занят.");
    }

    const now = new Date();
    const groupId = randomUUID();

    await txExecute(
      connection,
      `INSERT INTO groups_clans (id, slug, name, description, avatar_type, avatar_value, cover_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        groupId,
        normalizedSlug,
        normalizedName,
        normalizedDescription,
        "emoji",
        normalizedEmoji,
        normalizedCoverImage || null,
        now,
      ],
    );

    await txExecute(
      connection,
      `INSERT INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)`,
      [groupId, user.id, now],
    );

    return {
      id: groupId,
      slug: normalizedSlug,
    };
  });
}

export async function submitVerification(input: VerificationInput): Promise<VerificationRequest> {
  return withTransaction(async (connection) => {
    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [input.userId]);

    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    const request: VerificationRequest = {
      id: randomUUID(),
      userId: user.id,
      reason: input.reason.trim(),
      consent: input.consent,
      videoPath: input.videoPath,
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    await txExecute(
      connection,
      `INSERT INTO verification_requests (id, user_id, reason, consent, video_path, submitted_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [request.id, request.userId, request.reason, request.consent ? 1 : 0, request.videoPath, new Date(request.submittedAt), request.status],
    );
    await txExecute(connection, `UPDATE users SET verification_status = 'pending' WHERE id = ?`, [user.id]);
    await insertNotification(
      connection,
      buildNotification(user.id, "Заявка отправлена", "Видео и описание сохранены. После модерации рядом с именем появится галочка.", `/profile/${user.handle}`),
      { force: true },
    );

    queueRealtimeEvent(connection, {
      type: "profile:changed",
      recipients: [user.id],
      payload: {
        userId: user.id,
      },
    });

    return request;
  });
}

export async function reviewVerificationRequest(
  requestId: string,
  decision: "approved" | "rejected",
  adminUserId: string,
) {
  return withTransaction(async (connection) => {
    const [admin, requestRow] = await Promise.all([
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [adminUserId]),
      txQueryOne<VerificationRequestRow>(connection, `SELECT * FROM verification_requests WHERE id = ?`, [requestId]),
    ]);

    if (!admin || !isAdminHandle(admin.handle)) {
      throw new Error("Недостаточно прав для модерации верификации.");
    }

    if (!requestRow) {
      throw new Error("Заявка не найдена.");
    }

    if (requestRow.status !== "pending") {
      throw new Error("Эта заявка уже обработана.");
    }

    const nextStatus = decision === "approved" ? "approved" : "none";

    await txExecute(connection, `UPDATE verification_requests SET status = ? WHERE id = ?`, [decision, requestId]);
    await txExecute(connection, `UPDATE users SET verification_status = ? WHERE id = ?`, [nextStatus, requestRow.user_id]);

    const user = await txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [requestRow.user_id]);

    if (user) {
        await insertNotification(
          connection,
          buildNotification(
            user.id,
            decision === "approved" ? "Верификация одобрена" : "Верификация отклонена",
            decision === "approved"
              ? "Модерация одобрила вашу заявку. Галочка уже появилась в профиле."
              : "Модерация отклонила заявку. Можно подать новую позже с более подробным описанием.",
            `/profile/${user.handle}`,
          ),
          { force: true },
        );

      queueRealtimeEvent(connection, {
        type: "profile:changed",
        recipients: [user.id],
        payload: {
          userId: user.id,
        },
      });
    }

    return { ok: true };
  });
}

export async function revokeVerification(userId: string, adminUserId: string) {
  return withTransaction(async (connection) => {
    const [admin, user] = await Promise.all([
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [adminUserId]),
      txQueryOne<UserRow>(connection, `SELECT * FROM users WHERE id = ?`, [userId]),
    ]);

    if (!admin || !isAdminHandle(admin.handle)) {
      throw new Error("Недостаточно прав для отзыва верификации.");
    }

    if (!user) {
      throw new Error("Пользователь не найден.");
    }

    if (user.verification_status !== "approved") {
      throw new Error("У пользователя сейчас нет активной верификации.");
    }

    await txExecute(connection, `UPDATE users SET verification_status = 'none' WHERE id = ?`, [user.id]);
    await insertNotification(
      connection,
      buildNotification(
        user.id,
        "Верификация отозвана",
        "Модерация отозвала галочку у профиля. При необходимости можно подать новую заявку.",
        `/profile/${user.handle}`,
      ),
      { force: true },
    );

    queueRealtimeEvent(connection, {
      type: "profile:changed",
      recipients: [user.id],
      payload: {
        userId: user.id,
      },
    });

    return { ok: true };
  });
}

export async function saveUpload(file: File, folder: string) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const sourceExt = file.name.split(".").pop()?.toLowerCase() || "bin";
  const isHeic =
    ["heic", "heif"].includes(sourceExt) ||
    ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"].includes(file.type);
  const buffer = isHeic
    ? Buffer.from(
        await heicConvert({
          buffer: sourceBuffer,
          format: "JPEG",
          quality: 0.92,
        }),
      )
    : sourceBuffer;
  const ext = isHeic ? "jpg" : sourceExt;
  const subdir = path.join(uploadsDir, folder);
  const filename = `${Date.now()}-${randomUUID()}.${ext}`;
  const absoluteDirectory = path.join(subdir);
  const absolutePath = path.join(absoluteDirectory, filename);

  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return `${folder}/${filename}`;
}

export async function readUpload(relativePath: string) {
  const absolutePath = path.join(uploadsDir, relativePath);
  return readFile(absolutePath);
}

export async function getLatestPreviewLink(email: string) {
  const row = await queryOne<MailPreviewRow>(
    `SELECT * FROM mail_previews WHERE email_to = ? ORDER BY created_at DESC LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  return row ? mapMailPreview(row) : null;
}

export async function getUserSummary(handle: string) {
  const user = await getFullUserByHandle(handle);

  if (!user) {
    return null;
  }

  return {
    ...user,
    joinedLabel: formatRelativeDate(user.createdAt),
  };
}
