import { db } from "@/lib/db";

import {
  canUserAccessChannel,
} from "@/lib/channel-permissions";

import {
  Permissions,
} from "@/lib/permissions";

import {
  isSafeStorageKey,
} from "@/lib/storage";

export function uploadPrefixForUser(
  userId: string,
) {
  return `attachments/${userId}/`;
}

export function isOwnedUploadKey(
  userId: string,
  key: string,
) {
  if (!isSafeStorageKey(key)) {
    return false;
  }

  return key.startsWith(
    uploadPrefixForUser(userId),
  );
}

function internalFileUrl(
  key: string,
) {
  return `/api/files?key=${encodeURIComponent(
    key,
  )}`;
}

function getPossibleStoredUrls(
  key: string,
) {
  const encoded =
    encodeURIComponent(key);

  return [
    key,

    `/api/files?key=${encoded}`,

    `/api/files?key=${key}`,
  ];
}

export async function canUserReadStorageKey(
  userId: string,
  key: string,
): Promise<boolean> {
  if (!isSafeStorageKey(key)) {
    return false;
  }

  /*
   * ========================================================
   * UPLOAD NOVO DO PRÓPRIO USUÁRIO
   * ========================================================
   *
   * attachments/{userId}/...
   *
   * Permite visualizar imediatamente após o upload,
   * mesmo antes de criar Attachment/Message no banco.
   */

  if (
    isOwnedUploadKey(
      userId,
      key,
    )
  ) {
    return true;
  }

  const possibleUrls =
    getPossibleStoredUrls(key);

  /*
   * ========================================================
   * ASSETS DE PERFIL
   * ========================================================
   */

  const userAsset =
    await db.user.findFirst({
      where: {
        OR: [
          {
            avatarUrl: {
              in: possibleUrls,
            },
          },

          {
            bannerUrl: {
              in: possibleUrls,
            },
          },
        ],
      },

      select: {
        id: true,
      },
    });

  if (userAsset) {
    return true;
  }

  /*
   * ========================================================
   * ASSETS DE GUILD
   * ========================================================
   */

  const guildAsset =
    await db.guild.findFirst({
      where: {
        OR: [
          {
            iconUrl: {
              in: possibleUrls,
            },
          },

          {
            bannerUrl: {
              in: possibleUrls,
            },
          },
        ],

        members: {
          some: {
            userId,
          },
        },
      },

      select: {
        id: true,
      },
    });

  if (guildAsset) {
    return true;
  }

  /*
   * ========================================================
   * DIRECT MESSAGE ATTACHMENT
   * ========================================================
   */

  const directAttachment =
    await db.directMessageAttachment.findFirst(
      {
        where: {
          url: {
            in: possibleUrls,
          },

          message: {
            deleted: false,

            conversation: {
              participants: {
                some: {
                  userId,
                },
              },
            },
          },
        },

        select: {
          id: true,
        },
      },
    );

  if (directAttachment) {
    return true;
  }

  /*
   * ========================================================
   * GUILD MESSAGE ATTACHMENT
   * ========================================================
   */

  const guildAttachment =
    await db.attachment.findFirst({
      where: {
        url: {
          in: possibleUrls,
        },

        message: {
          deleted: false,
        },
      },

      select: {
        message: {
          select: {
            channelId: true,
          },
        },
      },
    });

  if (guildAttachment) {
    const allowed =
      await canUserAccessChannel(
        userId,
        guildAttachment.message
          .channelId,
        [
          Permissions.VIEW_CHANNEL,

          Permissions.READ_MESSAGE_HISTORY,
        ],
      );

    if (allowed) {
      return true;
    }
  }

  const guildVoiceMessage =
    await db.voiceMessage.findFirst({
      where: {
        url: { in: possibleUrls },
        message: { deleted: false },
      },
      select: {
        message: {
          select: {
            channelId: true,
          },
        },
      },
    });

  if (guildVoiceMessage) {
    const allowed =
      await canUserAccessChannel(
        userId,
        guildVoiceMessage.message.channelId,
        [
          Permissions.VIEW_CHANNEL,
          Permissions.READ_MESSAGE_HISTORY,
        ],
      );

    if (allowed) {
      return true;
    }
  }

  const guildExpression =
    await db.guild.findFirst({
      where: {
        members: { some: { userId } },
        OR: [
          { stickers: { some: { url: { in: possibleUrls } } } },
          { soundboardSounds: { some: { url: { in: possibleUrls } } } },
        ],
      },
      select: { id: true },
    });

  if (guildExpression) {
    return true;
  }

  const directVoiceMessage =
    await db.directVoiceMessage.findFirst({
      where: {
        url: { in: possibleUrls },
        message: {
          deleted: false,
          conversation: {
            participants: {
              some: { userId },
            },
          },
        },
      },
      select: { id: true },
    });

  if (directVoiceMessage) {
    return true;
  }

  /*
   * ========================================================
   * LEGACY GUILD MESSAGE
   * ========================================================
   *
   * Compatibilidade com versões antigas que podiam salvar
   * attachments/2026/... diretamente no conteúdo.
   */

  const legacyMessage =
    await db.message.findFirst({
      where: {
        deleted: false,

        OR: [
          {
            content: {
              contains: key,
            },
          },

          {
            content: {
              contains:
                encodeURIComponent(
                  key,
                ),
            },
          },

          {
            content: {
              contains:
                internalFileUrl(
                  key,
                ),
            },
          },
        ],
      },

      select: {
        channelId: true,
      },
    });

  if (legacyMessage) {
    const allowed =
      await canUserAccessChannel(
        userId,
        legacyMessage.channelId,
        [
          Permissions.VIEW_CHANNEL,

          Permissions.READ_MESSAGE_HISTORY,
        ],
      );

    if (allowed) {
      return true;
    }
  }

  /*
   * ========================================================
   * LEGACY DIRECT MESSAGE
   * ========================================================
   */

  const legacyDirectMessage =
    await db.directMessage.findFirst({
      where: {
        deleted: false,

        conversation: {
          participants: {
            some: {
              userId,
            },
          },
        },

        OR: [
          {
            content: {
              contains: key,
            },
          },

          {
            content: {
              contains:
                encodeURIComponent(
                  key,
                ),
            },
          },

          {
            content: {
              contains:
                internalFileUrl(
                  key,
                ),
            },
          },
        ],
      },

      select: {
        id: true,
      },
    });

  if (legacyDirectMessage) {
    return true;
  }

  return false;
}
