export type ThemePreference = "light" | "dark" | "system";
export type VerificationStatus = "none" | "pending" | "approved";
export type AuthorType = "user" | "group";

export type Avatar = {
  type: "emoji" | "image";
  value: string;
};

export type User = {
  id: string;
  handle: string;
  name: string;
  email: string;
  passwordHash: string;
  bio: string;
  avatar: Avatar;
  coverImage: string | null;
  createdAt: string;
  verifiedEmailAt: string | null;
  followerIds: string[];
  followingIds: string[];
  likedPostIds: string[];
  themePreference: ThemePreference;
  verificationStatus: VerificationStatus;
  isAdmin: boolean;
};

export type Group = {
  id: string;
  slug: string;
  name: string;
  description: string;
  avatar: Avatar;
  coverImage: string | null;
  memberIds: string[];
  createdAt: string;
};

export type PollOption = {
  id: string;
  label: string;
  voterIds: string[];
};

export type Poll = {
  question: string;
  options: PollOption[];
};

export type Post = {
  id: string;
  authorType: AuthorType;
  authorId: string;
  content: string;
  imagePath: string | null;
  poll: Poll | null;
  repostOfPostId: string | null;
  createdAt: string;
  likeUserIds: string[];
};

export type PostComment = {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  imagePath: string | null;
  parentCommentId: string | null;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  description: string;
  link: string;
  createdAt: string;
  read: boolean;
};

export type Session = {
  token: string;
  userId: string;
  expiresAt: string;
};

export type VerificationToken = {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export type VerificationRequest = {
  id: string;
  userId: string;
  reason: string;
  consent: boolean;
  videoPath: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
};

export type PostReportCategory =
  | "spam"
  | "abuse"
  | "adult"
  | "violence"
  | "misinformation"
  | "other";

export type PostReport = {
  id: string;
  postId: string;
  reporterUserId: string;
  category: PostReportCategory;
  details: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  reviewedAt: string | null;
};

export type MailPreview = {
  id: string;
  to: string;
  subject: string;
  link: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  groups: Group[];
  posts: Post[];
  postReports: PostReport[];
  notifications: Notification[];
  sessions: Session[];
  verificationTokens: VerificationToken[];
  verificationRequests: VerificationRequest[];
  mailPreviews: MailPreview[];
};

export type DecoratedPost = Post & {
  author:
    | {
        type: "user";
        handle: string;
        name: string;
        avatar: Avatar;
        verificationStatus: VerificationStatus;
      }
    | {
        type: "group";
        slug: string;
        name: string;
        avatar: Avatar;
  };
  likeCount: number;
  commentCount: number;
  reportCount: number;
  likedByViewer: boolean;
  comments: DecoratedPostComment[];
  repostedPost: DecoratedPost | null;
};

export type DecoratedPostComment = PostComment & {
  author: {
    handle: string;
    name: string;
    avatar: Avatar;
    verificationStatus: VerificationStatus;
  };
};

export type AdminVerificationRequest = VerificationRequest & {
  user: {
    id: string;
    handle: string;
    name: string;
    avatar: Avatar;
    verificationStatus: VerificationStatus;
  };
};

export type AdminPostReport = PostReport & {
  reporter: {
    id: string;
    handle: string;
    name: string;
    avatar: Avatar;
  };
  post: DecoratedPost | null;
};
