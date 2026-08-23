"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

function generateInviteCode(length = 8) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  const bytes = crypto.randomBytes(length);

  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }

  return code;
}

export async function acceptGuildInvite(code: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }

  const normalizedCode = code.trim();

  if (!normalizedCode) {
    throw new Error("INVALID_INVITE");
  }

  return db.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({
      where: {
        code: normalizedCode,
      },
      include: {
        guild: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            bannerUrl: true,
          },
        },
      },
    });

    if (!invite) {
      throw new Error("INVITE_NOT_FOUND");
    }

    if (
      invite.expiresAt &&
      invite.expiresAt.getTime() <= Date.now()
    ) {
      throw new Error("INVITE_EXPIRED");
    }

    if (
      invite.maxUses > 0 &&
      invite.uses >= invite.maxUses
    ) {
      throw new Error("INVITE_EXHAUSTED");
    }

    const existingMember = await tx.member.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: invite.guildId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingMember) {
      return {
        alreadyMember: true,
        guildId: invite.guildId,
      };
    }

    const everyoneRole = await tx.role.findFirst({
      where: {
        guildId: invite.guildId,
        isDefault: true,
      },
      select: {
        id: true,
      },
    });

    if (!everyoneRole) {
      throw new Error("DEFAULT_ROLE_NOT_FOUND");
    }

    await tx.member.create({
      data: {
        userId: user.id,
        guildId: invite.guildId,

        roles: {
          connect: {
            id: everyoneRole.id,
          },
        },
      },
    });

    await tx.invite.update({
      where: {
        id: invite.id,
      },
      data: {
        uses: {
          increment: 1,
        },
      },
    });

    return {
      alreadyMember: false,
      guildId: invite.guildId,
      guild: invite.guild,
    };
  });
}

async function generateUniqueInviteCode() {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();

    const exists = await db.invite.findUnique({
      where: {
        code,
      },
      select: {
        id: true,
      },
    });

    if (!exists) {
      return code;
    }
  }

  throw new Error("Não foi possível gerar um código de convite.");
}

export async function getGuildInvites(guildId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  await requirePermission(
    guildId,
    Permissions.CREATE_INSTANT_INVITE
  );

  return db.invite.findMany({
    where: {
      guildId,
    },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          globalName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createGuildInvite(
  guildId: string,
  options?: {
    maxUses?: number;
    expiresIn?: number | null;
  }
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  await requirePermission(
    guildId,
    Permissions.CREATE_INSTANT_INVITE
  );

  const guild = await db.guild.findUnique({
    where: {
      id: guildId,
    },
    select: {
      id: true,
    },
  });

  if (!guild) {
    throw new Error("Servidor não encontrado.");
  }

  const maxUses = Math.max(
    0,
    Math.floor(options?.maxUses ?? 0)
  );

  let expiresAt: Date | null = null;

  if (
    options?.expiresIn !== undefined &&
    options.expiresIn !== null &&
    options.expiresIn > 0
  ) {
    expiresAt = new Date(
      Date.now() + options.expiresIn * 1000
    );
  }

  const code = await generateUniqueInviteCode();

  const invite = await db.invite.create({
    data: {
      code,
      guildId,
      creatorId: user.id,
      maxUses,
      expiresAt,
    },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          globalName: true,
          avatarUrl: true,
        },
      },
    },
  });

  revalidatePath(`/channels/${guildId}`);

  return invite;
}

export async function deleteGuildInvite(
  guildId: string,
  inviteId: string
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  await requirePermission(
    guildId,
    Permissions.CREATE_INSTANT_INVITE
  );

  const invite = await db.invite.findFirst({
    where: {
      id: inviteId,
      guildId,
    },
  });

  if (!invite) {
    throw new Error("Convite não encontrado.");
  }

  await db.invite.delete({
    where: {
      id: invite.id,
    },
  });

  revalidatePath(`/channels/${guildId}`);

  return {
    success: true,
  };
}