import { db } from "@/lib/db";

function getDisplayMessageContent(value: unknown) {
  const text = String(value ?? "");
  try {
    const parsed = JSON.parse(text);
    if ((parsed?.version === 1 || parsed?.version === 2) && parsed?.algorithm === "AES-GCM+RSA-OAEP-256") return "Mensagem protegida";
    return parsed && typeof parsed.content === "string" ? parsed.content : text;
  } catch {
    return text;
  }
}

export const directUserSelect = {
  id: true,
  username: true,
  globalName: true,
  avatarUrl: true,
  bannerUrl: true,
  bio: true,
  status: true,
  e2eePublicKey: true,
  e2eeDevices: {
    where: { revokedAt: null },
    select: {
      deviceId: true,
      label: true,
      publicKey: true,
      fingerprint: true,
    },
  },
} as const;

export function displayName(user: {
  username: string;
  globalName: string | null;
}) {
  return user.globalName?.trim() || user.username;
}

export async function relationshipBetween(userAId: string, userBId: string) {
  return db.relationship.findFirst({
    where: {
      OR: [
        { userOneId: userAId, userTwoId: userBId },
        { userOneId: userBId, userTwoId: userAId },
      ],
    },
    include: {
      userOne: { select: directUserSelect },
      userTwo: { select: directUserSelect },
    },
  });
}

export async function areFriends(userAId: string, userBId: string) {
  const relationship = await relationshipBetween(userAId, userBId);
  return relationship?.type === "FRIEND";
}

export async function isBlocked(userAId: string, userBId: string) {
  const relationship = await relationshipBetween(userAId, userBId);
  return relationship?.type === "BLOCKED";
}

export function serializeRelationship(
  relationship: any,
  currentUserId: string,
) {
  const otherUser =
    relationship.userOneId === currentUserId
      ? relationship.userTwo
      : relationship.userOne;

  let direction:
    | "friend"
    | "incoming"
    | "outgoing"
    | "blocked_by_me"
    | "blocked_me";

  if (relationship.type === "FRIEND") {
    direction = "friend";
  } else if (relationship.type === "PENDING") {
    direction =
      relationship.userOneId === currentUserId ? "outgoing" : "incoming";
  } else {
    direction =
      relationship.userOneId === currentUserId
        ? "blocked_by_me"
        : "blocked_me";
  }

  return {
    id: relationship.id,
    type: relationship.type,
    direction,
    createdAt: relationship.createdAt.toISOString(),
    otherUser,
  };
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
) {
  return db.directConversation.findFirst({
    where: {
      id: conversationId,
      participants: {
        some: {
          userId,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: directUserSelect,
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
      messages: {
        where: { deleted: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          author: {
            select: directUserSelect,
          },
          attachments: true,
        },
      },
    },
  });
}

export function serializeConversation(
  conversation: any,
  currentUserId: string,
) {
  const members = conversation.participants.map((item: any) => item.user);
  const others = members.filter((member: any) => member.id !== currentUserId);
  const dmUser = others[0] ?? members[0] ?? null;
  const lastMessage = conversation.messages?.[0] ?? null;
  const currentParticipant = conversation.participants.find((item: any) => item.userId === currentUserId);

  const groupDisplayName =
    conversation.name?.trim() ||
    others
      .slice(0, 4)
      .map((member: any) => displayName(member))
      .join(", ") ||
    "Grupo";

  return {
    id: conversation.id,
    type: conversation.type,
    name: conversation.name,
    iconUrl: conversation.iconUrl,
    displayName:
      conversation.type === "GROUP"
        ? groupDisplayName
        : dmUser
          ? displayName(dmUser)
          : "Mensagem direta",
    displayAvatarUrl:
      conversation.type === "GROUP"
        ? conversation.iconUrl
        : dmUser?.avatarUrl ?? null,
    ownerId: conversation.ownerId,
    members,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: getDisplayMessageContent(lastMessage.content),
          createdAt: lastMessage.createdAt.toISOString(),
          authorId: lastMessage.authorId,
          authorName: displayName(lastMessage.author),
          hasAttachments: lastMessage.attachments.length > 0,
        }
      : null,
    updatedAt: conversation.updatedAt.toISOString(),
    isFavorite: Boolean(currentParticipant?.isFavorite),
    folder: currentParticipant?.folder ? { id: currentParticipant.folder.id, name: currentParticipant.folder.name, color: currentParticipant.folder.color ?? null } : null,
  };
}

export async function listConversations(userId: string) {
  const conversations = await db.directConversation.findMany({
    where: {
      participants: {
        some: {
          userId,
          isHidden: false,
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: directUserSelect,
          },
          folder: { select: { id: true, name: true, color: true } },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
      messages: {
        where: { deleted: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          author: {
            select: directUserSelect,
          },
          attachments: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return conversations.map((conversation) =>
    serializeConversation(conversation, userId),
  );
}

export function serializeDirectMessage(message: any, currentUserId: string) {
  type ReactionGroup = {
    emoji: string;
    count: number;
    reactedByMe: boolean;
    users: Array<{
      id: string;
      username: string;
      globalName: string | null;
    }>;
  };

  const grouped = new Map<
    string,
    ReactionGroup
  >();

  for (const reaction of message.reactions ?? []) {
    const current: ReactionGroup = grouped.get(reaction.emoji) ?? {
      emoji: reaction.emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };

    current.count += 1;
    current.reactedByMe ||= reaction.userId === currentUserId;
    current.users.push({
      id: reaction.user.id,
      username: reaction.user.username,
      globalName: reaction.user.globalName,
    });

    grouped.set(reaction.emoji, current);
  }

  const rawContent = String(message.content ?? "");
  const encrypted = (() => { try { const parsed = JSON.parse(rawContent); return (parsed?.version === 1 || parsed?.version === 2) && parsed?.algorithm === "AES-GCM+RSA-OAEP-256"; } catch { return false; } })();
  return {
    id: message.id,
    content: message.deleted ? "" : getDisplayMessageContent(message.content),
    ...(encrypted && !message.deleted ? { encryptedContent: rawContent } : {}),
    deleted: message.deleted,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    expiresAt: message.expiresAt?.toISOString() ?? null,
    author: message.author,
    replyToId: message.replyToId,
    reply: message.replyTo
      ? {
          id: message.replyTo.id,
          content: message.replyTo.deleted ? "" : getDisplayMessageContent(message.replyTo.content),
          deleted: message.replyTo.deleted,
          author: message.replyTo.author,
        }
      : null,
    attachments: message.deleted ? [] : message.attachments,
    reactions: message.deleted ? [] : Array.from(grouped.values()),
  };
}

export const directMessageInclude = {
  author: {
    select: directUserSelect,
  },
  replyTo: {
    include: {
      author: {
        select: {
          id: true,
          username: true,
          globalName: true,
        },
      },
    },
  },
  attachments: true,
  reactions: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          globalName: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
} as const;

export async function assertConversationMember(
  conversationId: string,
  userId: string,
) {
  const participant = await db.directConversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
  });

  if (!participant) {
    throw new Error("FORBIDDEN");
  }

  return participant;
}
