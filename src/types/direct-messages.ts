export type UserStatus = "ONLINE" | "IDLE" | "DND" | "OFFLINE";

export type DirectUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  status: UserStatus;
};

export type RelationshipType = "FRIEND" | "PENDING" | "BLOCKED";

export type RelationshipDirection =
  | "friend"
  | "incoming"
  | "outgoing"
  | "blocked_by_me"
  | "blocked_me";

export type RelationshipSummary = {
  id: string;
  type: RelationshipType;
  direction: RelationshipDirection;
  createdAt: string;
  otherUser: DirectUser;
};

export type DirectMessageAttachment = {
  id: string;
  url: string;
  filename: string;
  fileSize: number;
  fileType: string;
};

export type DirectMessageReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  users: Array<{
    id: string;
    username: string;
    globalName: string | null;
  }>;
};

export type DirectMessageReplyPreview = {
  id: string;
  content: string;
  deleted: boolean;
  author: {
    id: string;
    username: string;
    globalName: string | null;
  };
} | null;

export type DirectMessageItem = {
  id: string;
  content: string;
  deleted: boolean;
  createdAt: string;
  editedAt: string | null;
  author: DirectUser;
  replyToId: string | null;
  reply: DirectMessageReplyPreview;
  attachments: DirectMessageAttachment[];
  reactions: DirectMessageReaction[];
};

export type ConversationType = "DM" | "GROUP";

export type DirectConversationSummary = {
  id: string;
  type: ConversationType;
  name: string | null;
  iconUrl: string | null;
  displayName: string;
  displayAvatarUrl: string | null;
  ownerId: string | null;
  members: DirectUser[];
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
    authorName: string;
    hasAttachments: boolean;
  } | null;
  updatedAt: string;
};

export type DirectMessagesBootstrap = {
  currentUser: DirectUser;
  conversations: DirectConversationSummary[];
  relationships: RelationshipSummary[];
};

export type UserSearchResult = DirectUser & {
  relationship: RelationshipSummary | null;
};