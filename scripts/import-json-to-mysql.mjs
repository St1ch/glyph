import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const root = process.cwd();
const sourceFile = path.join(root, "storage", "db.json");

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Fill MySQL env vars before import.`);
  }

  return value;
}

function asMysqlDate(value) {
  return value ? new Date(value) : null;
}

const pool = mysql.createPool({
  host: required("DB_HOST"),
  port: Number(process.env.DB_PORT || 3306),
  user: required("DB_USER"),
  password: process.env.DB_PASSWORD || "",
  database: required("DB_NAME"),
  charset: "utf8mb4",
  waitForConnections: true,
});

const raw = await fs.readFile(sourceFile, "utf8");
const data = JSON.parse(raw);

const connection = await pool.getConnection();

try {
  await connection.beginTransaction();

  const tables = [
    "poll_votes",
    "poll_options",
    "polls",
    "post_likes",
    "posts",
    "group_members",
    "follows",
    "notifications",
    "sessions",
    "verification_tokens",
    "verification_requests",
    "mail_previews",
    "groups_clans",
    "users",
  ];

  for (const table of tables) {
    await connection.query(`DELETE FROM ${table}`);
  }

  for (const user of data.users) {
    await connection.execute(
      `INSERT INTO users
       (id, handle, name, email, password_hash, bio, avatar_type, avatar_value, cover_image, created_at, verified_email_at, theme_preference, verification_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.handle,
        user.name,
        user.email,
        user.passwordHash,
        user.bio,
        user.avatar.type,
        user.avatar.value,
        user.coverImage,
        asMysqlDate(user.createdAt),
        asMysqlDate(user.verifiedEmailAt),
        user.themePreference,
        user.verificationStatus,
      ],
    );
  }

  for (const group of data.groups) {
    await connection.execute(
      `INSERT INTO groups_clans
       (id, slug, name, description, avatar_type, avatar_value, cover_image, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        group.id,
        group.slug,
        group.name,
        group.description,
        group.avatar.type,
        group.avatar.value,
        group.coverImage,
        asMysqlDate(group.createdAt),
      ],
    );

    for (const memberId of group.memberIds) {
      await connection.execute(
        `INSERT INTO group_members (group_id, user_id, created_at) VALUES (?, ?, ?)`,
        [group.id, memberId, asMysqlDate(group.createdAt)],
      );
    }
  }

  for (const user of data.users) {
    for (const followingId of user.followingIds) {
      await connection.execute(
        `INSERT INTO follows (follower_user_id, following_user_id, created_at) VALUES (?, ?, ?)`,
        [user.id, followingId, asMysqlDate(user.createdAt)],
      );
    }
  }

  for (const post of data.posts) {
    await connection.execute(
      `INSERT INTO posts (id, author_type, author_id, content, image_path, repost_of_post_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        post.id,
        post.authorType,
        post.authorId,
        post.content,
        post.imagePath,
        post.repostOfPostId || null,
        asMysqlDate(post.createdAt),
      ],
    );

    for (const userId of post.likeUserIds) {
      await connection.execute(
        `INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`,
        [post.id, userId, asMysqlDate(post.createdAt)],
      );
    }

    if (post.poll) {
      const pollId = `poll-${post.id}`;
      await connection.execute(
        `INSERT INTO polls (id, post_id, question) VALUES (?, ?, ?)`,
        [pollId, post.id, post.poll.question],
      );

      for (const option of post.poll.options) {
        await connection.execute(
          `INSERT INTO poll_options (id, poll_id, label) VALUES (?, ?, ?)`,
          [option.id, pollId, option.label],
        );

        for (const userId of option.voterIds) {
          await connection.execute(
            `INSERT INTO poll_votes (option_id, user_id, created_at) VALUES (?, ?, ?)`,
            [option.id, userId, asMysqlDate(post.createdAt)],
          );
        }
      }
    }
  }

  for (const item of data.notifications) {
    await connection.execute(
      `INSERT INTO notifications (id, user_id, title, description, link, created_at, is_read)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.userId,
        item.title,
        item.description,
        item.link,
        asMysqlDate(item.createdAt),
        item.read ? 1 : 0,
      ],
    );
  }

  for (const session of data.sessions) {
    await connection.execute(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
      [session.token, session.userId, asMysqlDate(session.expiresAt)],
    );
  }

  for (const item of data.verificationTokens) {
    await connection.execute(
      `INSERT INTO verification_tokens (token, user_id, email, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        item.token,
        item.userId,
        item.email,
        asMysqlDate(item.expiresAt),
        asMysqlDate(item.createdAt),
      ],
    );
  }

  for (const item of data.verificationRequests) {
    await connection.execute(
      `INSERT INTO verification_requests (id, user_id, reason, consent, video_path, submitted_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.userId,
        item.reason,
        item.consent ? 1 : 0,
        item.videoPath,
        asMysqlDate(item.submittedAt),
        item.status,
      ],
    );
  }

  for (const item of data.mailPreviews) {
    await connection.execute(
      `INSERT INTO mail_previews (id, email_to, subject, link, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [item.id, item.to, item.subject, item.link, asMysqlDate(item.createdAt)],
    );
  }

  await connection.commit();
  console.log("Import completed.");
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await pool.end();
}
