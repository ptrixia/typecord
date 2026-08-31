"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { dispatchGuildEvent } from "@/lib/gateway/guild-events";
import { Permissions, normalizePermissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

const VANITY_RE = /^[a-z0-9][a-z0-9-_]{2,31}$/;
const EMOJI_RE = /^[a-zA-Z0-9_]{2,32}$/;

async function requireGuildMember(guildId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autorizado.");

  const member = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: user.id,
        guildId,
      },
    },
    select: {
      id: true,
      userId: true,
      roles: {
        select: {
          id: true,
          position: true,
          permissions: true,
        },
      },
      guild: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  });

  if (!member) throw new Error("Você não faz parte deste servidor.");

  return { user, member };
}

async function can(guildId: string, permission: bigint) {
  try {
    await requirePermission(guildId, permission);
    return true;
  } catch {
    return false;
  }
}

function topPosition(member: { roles: { position: number }[] }, owner: boolean) {
  if (owner) return Number.MAX_SAFE_INTEGER;
  return member.roles.reduce((max, role) => Math.max(max, role.position), 0);
}

async function assertCanModerate(
  guildId: string,
  targetMemberId: string,
  permission: bigint,
) {
  const actor = await requirePermission(guildId, permission);

  const [guild, actorMember, target] = await Promise.all([
    db.guild.findUnique({
      where: { id: guildId },
      select: { ownerId: true },
    }),
    db.member.findUnique({
      where: {
        userId_guildId: {
          userId: actor.id,
          guildId,
        },
      },
      select: {
        userId: true,
        roles: { select: { position: true } },
      },
    }),
    db.member.findUnique({
      where: { id: targetMemberId },
      select: {
        id: true,
        guildId: true,
        userId: true,
        roles: { select: { position: true } },
        user: {
          select: {
            id: true,
            username: true,
            globalName: true,
          },
        },
      },
    }),
  ]);

  if (!guild || !actorMember) throw new Error("Servidor não encontrado.");
  if (!target || target.guildId !== guildId) throw new Error("Membro não encontrado.");
  if (target.userId === guild.ownerId) throw new Error("O dono do servidor não pode ser moderado.");
  if (target.userId === actor.id) throw new Error("Você não pode executar esta ação em si mesmo.");

  const actorTop = topPosition(actorMember, guild.ownerId === actor.id);
  const targetTop = topPosition(target, false);

  if (guild.ownerId !== actor.id && targetTop >= actorTop) {
    throw new Error("Você não pode moderar um membro com cargo igual ou superior ao seu.");
  }

  return { actor, target, guild };
}

async function invalidateGuildUsers(guildId: string) {
  const members = await db.member.findMany({
    where: { guildId },
    select: { userId: true },
  });

  if (members.length) {
    await redis.del(...members.map((member) => `user:${member.userId}:guilds`));
  }
}

export async function getGuildSettingsExtras(guildId: string) {
  const { user, member } = await requireGuildMember(guildId);

  const [guild, capabilities] = await Promise.all([
    db.guild.findUnique({
      where: { id: guildId },
      select: {
        id: true,
        name: true,
        iconUrl: true,
        bannerUrl: true,
        vanityUrl: true,
        verified: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            globalName: true,
            avatarUrl: true,
          },
        },
        emojis: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            url: true,
            createdAt: true,
            creator: {
              select: {
                id: true,
                username: true,
                globalName: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            roles: true,
            categories: true,
            channels: true,
            emojis: true,
            invites: true,
            bans: true,
          },
        },
      },
    }),
    Promise.all([
      can(guildId, Permissions.MANAGE_GUILD),
      can(guildId, Permissions.MANAGE_ROLES),
      can(guildId, Permissions.MANAGE_CHANNELS),
      can(guildId, Permissions.KICK_MEMBERS),
      can(guildId, Permissions.BAN_MEMBERS),
      can(guildId, Permissions.MANAGE_NICKNAMES),
      can(guildId, Permissions.MANAGE_EXPRESSIONS),
      can(guildId, Permissions.CREATE_INSTANT_INVITE),
      can(guildId, Permissions.VIEW_AUDIT_LOG),
      can(guildId, Permissions.MANAGE_EVENTS),
      can(guildId, Permissions.CREATE_EVENTS),
      can(guildId, Permissions.MODERATE_MEMBERS),
    ]),
  ]);

  if (!guild) throw new Error("Servidor não encontrado.");

  const [
    canManageGuild,
    canManageRoles,
    canManageChannels,
    canKickMembers,
    canBanMembers,
    canManageNicknames,
    canManageExpressions,
    canCreateInvites,
    canViewAuditLog,
    canManageEvents,
    canCreateEvents,
    canModerateMembers,
  ] = capabilities;

  const [bans, auditLogs, moderationActions, autoModRules, scheduledEvents, templates, stickers, sounds, onboarding] = await Promise.all([
    canBanMembers
      ? db.guildBan.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reason: true,
            userId: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                username: true,
                globalName: true,
                avatarUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canViewAuditLog
      ? db.auditLog.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            actorId: true,
            action: true,
            targetId: true,
            metadata: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    canModerateMembers
      ? db.moderationAction.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            targetUser: {
              select: {
                id: true,
                username: true,
                globalName: true,
                avatarUrl: true,
              },
            },
            moderator: {
              select: {
                id: true,
                username: true,
                globalName: true,
                avatarUrl: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canManageGuild
      ? db.autoModRule.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canManageEvents || canCreateEvents
      ? db.scheduledEvent.findMany({
          where: { guildId },
          orderBy: { scheduledStartAt: "asc" },
        })
      : Promise.resolve([]),
    canManageGuild
      ? db.serverTemplate.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canManageExpressions
      ? db.sticker.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canManageExpressions
      ? db.soundboardSound.findMany({
          where: { guildId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canManageGuild
      ? db.guildOnboarding.findUnique({ where: { guildId } })
      : Promise.resolve(null),
  ]);

  let actors = new Map<string, { id: string; username: string; globalName: string | null; avatarUrl: string | null }>();

  if (auditLogs.length) {
    const actorIds = [...new Set(auditLogs.map((entry) => entry.actorId))];
    const users = await db.user.findMany({
      where: { id: { in: actorIds } },
      select: {
        id: true,
        username: true,
        globalName: true,
        avatarUrl: true,
      },
    });
    actors = new Map(users.map((actor) => [actor.id, actor]));
  }

  return {
    guild,
    isOwner: guild.ownerId === user.id,
    currentMemberId: member.id,
    capabilities: {
      canManageGuild,
      canManageRoles,
      canManageChannels,
      canKickMembers,
      canBanMembers,
      canManageNicknames,
      canManageExpressions,
      canCreateInvites,
      canViewAuditLog,
      canManageEvents,
      canCreateEvents,
      canModerateMembers,
    },
    bans,
    moderationActions,
    autoModRules,
    scheduledEvents,
    templates,
    stickers,
    sounds,
    onboarding,
    auditLogs: auditLogs.map((entry) => ({
      ...entry,
      actor: actors.get(entry.actorId) ?? null,
    })),
  };
}

export async function updateGuildProfile(
  guildId: string,
  values: {
    name?: string;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    vanityUrl?: string | null;
    accentColor?: string | null;
    backgroundUrl?: string | null;
  },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_GUILD);
  const data: Record<string, unknown> = {};

  if (values.name !== undefined) {
    const name = values.name.trim().replace(/\s+/g, " ");
    if (!name || name.length > 100) throw new Error("Nome do servidor inválido.");
    data.name = name;
  }

  if (values.iconUrl !== undefined) data.iconUrl = values.iconUrl || null;
  if (values.bannerUrl !== undefined) data.bannerUrl = values.bannerUrl || null;
  if (values.accentColor !== undefined) {
    const color = values.accentColor?.trim() || null;
    if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("A cor de destaque deve estar no formato hexadecimal.");
    data.accentColor = color;
  }
  if (values.backgroundUrl !== undefined) data.backgroundUrl = values.backgroundUrl || null;

  if (values.vanityUrl !== undefined) {
    const vanity = values.vanityUrl?.trim().toLowerCase() || null;
    if (vanity && !VANITY_RE.test(vanity)) {
      throw new Error("A URL personalizada deve ter entre 3 e 32 caracteres e usar apenas letras minúsculas, números, hífen ou underscore.");
    }
    data.vanityUrl = vanity;
  }

  try {
    const guild = await db.guild.update({
      where: { id: guildId },
      data,
    });

    await db.auditLog.create({
      data: {
        guildId,
        actorId: actor.id,
        action: "GUILD_UPDATE",
        metadata: { changes: data as Prisma.InputJsonObject },
      },
    });

    await invalidateGuildUsers(guildId);
    revalidatePath(`/channels/${guildId}`);
    await dispatchGuildEvent(guildId, "GUILD_UPDATE", { guild });
    return guild;
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error("Esta URL personalizada já está em uso.");
    throw error;
  }
}


export async function updateDefaultRolePermissions(
  guildId: string,
  roleId: string,
  permissions: string,
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_ROLES);

  const [guild, role] = await Promise.all([
    db.guild.findUnique({
      where: { id: guildId },
      select: { ownerId: true },
    }),
    db.role.findUnique({
      where: { id: roleId },
      select: { id: true, guildId: true, isDefault: true, managed: true },
    }),
  ]);

  if (!guild || !role || role.guildId !== guildId || !role.isDefault || role.managed) {
    throw new Error("Cargo padrão inválido.");
  }

  const bits = normalizePermissions(permissions);
  if (guild.ownerId !== actor.id && (bits & Permissions.ADMINISTRATOR) !== 0n) {
    throw new Error("Somente o dono do servidor pode conceder Administrador ao @everyone.");
  }

  const updated = await db.role.update({
    where: { id: role.id },
    data: { permissions: bits.toString() },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "ROLE_UPDATE",
      targetId: role.id,
      metadata: { changes: { permissions: bits.toString() }, defaultRole: true },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_ROLE_UPDATE", { role: updated });
  return updated;
}

export async function updateGuildMemberNickname(memberId: string, nickname: string | null) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { guildId: true },
  });
  if (!member) throw new Error("Membro não encontrado.");

  const { actor, target } = await assertCanModerate(
    member.guildId,
    memberId,
    Permissions.MANAGE_NICKNAMES,
  );

  const normalized = nickname?.trim().replace(/\s+/g, " ") || null;
  if (normalized && normalized.length > 100) throw new Error("Apelido muito longo.");

  const updated = await db.member.update({
    where: { id: memberId },
    data: { nickname: normalized },
  });

  await db.auditLog.create({
    data: {
      guildId: member.guildId,
      actorId: actor.id,
      action: "MEMBER_NICKNAME_UPDATE",
      targetId: target.id,
      metadata: { nickname: normalized },
    },
  });

  revalidatePath(`/channels/${member.guildId}`);
  await dispatchGuildEvent(member.guildId, "GUILD_MEMBER_UPDATE", {
    member: updated,
  });
  return updated;
}

export async function kickGuildMember(memberId: string, reason?: string | null) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { guildId: true },
  });
  if (!member) throw new Error("Membro não encontrado.");

  const { actor, target } = await assertCanModerate(
    member.guildId,
    memberId,
    Permissions.KICK_MEMBERS,
  );

  await db.$transaction([
    db.auditLog.create({
      data: {
        guildId: member.guildId,
        actorId: actor.id,
        action: "MEMBER_KICK",
        targetId: target.userId,
        metadata: { reason: reason?.trim() || null },
      },
    }),
    db.member.delete({ where: { id: memberId } }),
  ]);

  await redis.del(`user:${target.userId}:guilds`);
  revalidatePath(`/channels/${member.guildId}`);
  await dispatchGuildEvent(member.guildId, "GUILD_MEMBER_REMOVE", {
    userId: target.userId,
    memberId,
    reason: reason?.trim() || null,
  });
  return true;
}

export async function banGuildMember(memberId: string, reason?: string | null) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { guildId: true },
  });
  if (!member) throw new Error("Membro não encontrado.");

  const { actor, target } = await assertCanModerate(
    member.guildId,
    memberId,
    Permissions.BAN_MEMBERS,
  );

  const cleanReason = reason?.trim().slice(0, 1000) || null;

  await db.$transaction(async (tx) => {
    await tx.guildBan.upsert({
      where: {
        guildId_userId: {
          guildId: member.guildId,
          userId: target.userId,
        },
      },
      create: {
        guildId: member.guildId,
        userId: target.userId,
        reason: cleanReason,
      },
      update: { reason: cleanReason },
    });

    await tx.auditLog.create({
      data: {
        guildId: member.guildId,
        actorId: actor.id,
        action: "MEMBER_BAN",
        targetId: target.userId,
        metadata: { reason: cleanReason },
      },
    });

    await tx.member.delete({ where: { id: memberId } });
  });

  await redis.del(`user:${target.userId}:guilds`);
  revalidatePath(`/channels/${member.guildId}`);
  await Promise.allSettled([
    dispatchGuildEvent(member.guildId, "GUILD_BAN_ADD", {
      userId: target.userId,
      reason: cleanReason,
    }),
    dispatchGuildEvent(member.guildId, "GUILD_MEMBER_REMOVE", {
      userId: target.userId,
      memberId,
      reason: cleanReason,
    }),
  ]);
  return true;
}

export async function unbanGuildMember(guildId: string, userId: string) {
  const actor = await requirePermission(guildId, Permissions.BAN_MEMBERS);

  const result = await db.guildBan.deleteMany({
    where: { guildId, userId },
  });

  if (!result.count) throw new Error("Banimento não encontrado.");

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "MEMBER_UNBAN",
      targetId: userId,
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_BAN_REMOVE", { userId });
  return true;
}

export async function createGuildEmoji(
  guildId: string,
  values: { name: string; url: string },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_EXPRESSIONS);
  const name = values.name.trim();
  const url = values.url.trim();

  if (!EMOJI_RE.test(name)) {
    throw new Error("O nome do emoji deve ter de 2 a 32 caracteres usando letras, números ou underscore.");
  }
  if (!url) throw new Error("Envie uma imagem para o emoji.");

  const duplicate = await db.emoji.findFirst({
    where: { guildId, name },
    select: { id: true },
  });
  if (duplicate) throw new Error("Já existe um emoji com este nome neste servidor.");

  const emoji = await db.emoji.create({
    data: {
      guildId,
      creatorId: actor.id,
      name,
      url,
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

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "EMOJI_CREATE",
      targetId: emoji.id,
      metadata: { name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_UPDATE", { emoji });
  return emoji;
}

export async function deleteGuildEmoji(emojiId: string) {
  const emoji = await db.emoji.findUnique({
    where: { id: emojiId },
    select: { id: true, guildId: true, name: true },
  });
  if (!emoji) throw new Error("Emoji não encontrado.");

  const actor = await requirePermission(emoji.guildId, Permissions.MANAGE_EXPRESSIONS);
  await db.emoji.delete({ where: { id: emoji.id } });
  await db.auditLog.create({
    data: {
      guildId: emoji.guildId,
      actorId: actor.id,
      action: "EMOJI_DELETE",
      targetId: emoji.id,
      metadata: { name: emoji.name },
    },
  });

  revalidatePath(`/channels/${emoji.guildId}`);
  await dispatchGuildEvent(emoji.guildId, "GUILD_UPDATE", {
    emojiId: emoji.id,
  });
  return true;
}

export async function updateGuildOnboarding(
  guildId: string,
  values: {
    enabled: boolean;
    rules?: string | null;
    questions?: unknown;
    suggestedChannels?: unknown;
    autoRoleIds?: string[];
  },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_GUILD);
  const roleIds = Array.isArray(values.autoRoleIds) ? values.autoRoleIds.slice(0, 20) : [];
  const validRoles = roleIds.length
    ? await db.role.findMany({
        where: {
          guildId,
          id: { in: roleIds },
          isDefault: false,
          managed: false,
        },
        select: { id: true },
      })
    : [];

  const onboarding = await db.guildOnboarding.upsert({
    where: { guildId },
    create: {
      guildId,
      enabled: Boolean(values.enabled),
      rules: values.rules?.trim().slice(0, 5000) || null,
      questions: (values.questions ?? []) as Prisma.InputJsonValue,
      suggestedChannels: (values.suggestedChannels ?? []) as Prisma.InputJsonValue,
      autoRoleIds: validRoles.map((role) => role.id),
    },
    update: {
      enabled: Boolean(values.enabled),
      rules: values.rules?.trim().slice(0, 5000) || null,
      questions: (values.questions ?? []) as Prisma.InputJsonValue,
      suggestedChannels: (values.suggestedChannels ?? []) as Prisma.InputJsonValue,
      autoRoleIds: validRoles.map((role) => role.id),
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "ONBOARDING_UPDATE",
      targetId: onboarding.id,
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_UPDATE", { onboarding });
  return onboarding;
}

export async function createScheduledEvent(
  guildId: string,
  values: {
    name: string;
    description?: string | null;
    location?: string | null;
    coverUrl?: string | null;
    entityType?: "VOICE" | "STAGE" | "EXTERNAL";
    channelId?: string | null;
    scheduledStartAt: string;
    scheduledEndAt?: string | null;
  },
) {
  const actor = await requirePermission(guildId, Permissions.CREATE_EVENTS);
  const name = values.name.trim().replace(/\s+/g, " ").slice(0, 100);
  const scheduledStartAt = new Date(values.scheduledStartAt);
  const scheduledEndAt = values.scheduledEndAt ? new Date(values.scheduledEndAt) : null;

  if (!name) throw new Error("Nome do evento inválido.");
  if (Number.isNaN(scheduledStartAt.getTime()) || scheduledStartAt.getTime() <= Date.now()) {
    throw new Error("Agende o evento para uma data futura.");
  }
  if (scheduledEndAt && scheduledEndAt.getTime() <= scheduledStartAt.getTime()) {
    throw new Error("O encerramento precisa acontecer depois do início.");
  }

  if (values.channelId) {
    const channel = await db.channel.findFirst({
      where: { id: values.channelId, guildId, type: { in: ["GUILD_VOICE", "GUILD_VIDEO"] } },
      select: { id: true },
    });
    if (!channel) throw new Error("Canal de evento inválido.");
  }

  const event = await db.scheduledEvent.create({
    data: {
      guildId,
      creatorId: actor.id,
      name,
      description: values.description?.trim().slice(0, 2000) || null,
      location: values.location?.trim().slice(0, 200) || null,
      coverUrl: values.coverUrl?.trim() || null,
      entityType: values.entityType ?? "EXTERNAL",
      channelId: values.channelId || null,
      scheduledStartAt,
      scheduledEndAt,
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "EVENT_CREATE",
      targetId: event.id,
      metadata: { name: event.name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_UPDATE", { scheduledEvent: event });
  return event;
}

export async function updateScheduledEventStatus(
  eventId: string,
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELED",
) {
  const event = await db.scheduledEvent.findUnique({
    where: { id: eventId },
    select: { id: true, guildId: true },
  });
  if (!event) throw new Error("Evento não encontrado.");

  const actor = await requirePermission(event.guildId, Permissions.MANAGE_EVENTS);
  const updated = await db.scheduledEvent.update({
    where: { id: event.id },
    data: { status },
  });

  await db.auditLog.create({
    data: {
      guildId: event.guildId,
      actorId: actor.id,
      action: "EVENT_STATUS_UPDATE",
      targetId: event.id,
      metadata: { status },
    },
  });

  revalidatePath(`/channels/${event.guildId}`);
  await dispatchGuildEvent(event.guildId, "GUILD_UPDATE", { scheduledEvent: updated });
  return updated;
}

export async function createAutoModRule(
  guildId: string,
  values: {
    name: string;
    triggerType: "SPAM" | "SUSPICIOUS_LINK" | "BLOCKED_WORD" | "CAPS_LOCK" | "FLOOD";
    actionType?: "BLOCK_MESSAGE" | "WARN" | "TIMEOUT";
    keywords?: string[];
    threshold?: number;
    durationSeconds?: number | null;
    reason?: string | null;
  },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_GUILD);
  const name = values.name.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!name) throw new Error("Nome da regra inválido.");

  const rule = await db.autoModRule.create({
    data: {
      guildId,
      name,
      triggerType: values.triggerType,
      actionType: values.actionType ?? "BLOCK_MESSAGE",
      keywords: (values.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean).slice(0, 100),
      threshold: Math.max(0, Math.trunc(values.threshold ?? 0)),
      durationSeconds: values.durationSeconds ? Math.max(60, Math.trunc(values.durationSeconds)) : null,
      reason: values.reason?.trim().slice(0, 1000) || null,
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "AUTOMOD_RULE_CREATE",
      targetId: rule.id,
      metadata: { name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  return rule;
}

export async function toggleAutoModRule(ruleId: string, enabled: boolean) {
  const rule = await db.autoModRule.findUnique({
    where: { id: ruleId },
    select: { id: true, guildId: true, name: true },
  });
  if (!rule) throw new Error("Regra não encontrada.");

  const actor = await requirePermission(rule.guildId, Permissions.MANAGE_GUILD);
  const updated = await db.autoModRule.update({
    where: { id: rule.id },
    data: { enabled },
  });

  await db.auditLog.create({
    data: {
      guildId: rule.guildId,
      actorId: actor.id,
      action: "AUTOMOD_RULE_UPDATE",
      targetId: rule.id,
      metadata: { enabled },
    },
  });

  revalidatePath(`/channels/${rule.guildId}`);
  return updated;
}

export async function createModerationWarning(
  memberId: string,
  reason: string,
) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { guildId: true },
  });
  if (!member) throw new Error("Membro não encontrado.");

  const { actor, target } = await assertCanModerate(member.guildId, memberId, Permissions.MODERATE_MEMBERS);
  const cleanReason = reason.trim().slice(0, 1000);
  if (!cleanReason) throw new Error("Informe um motivo para a advertência.");

  const action = await db.moderationAction.create({
    data: {
      guildId: member.guildId,
      targetUserId: target.userId,
      moderatorId: actor.id,
      type: "WARNING",
      reason: cleanReason,
    },
  });

  await db.auditLog.create({
    data: {
      guildId: member.guildId,
      actorId: actor.id,
      action: "MEMBER_WARN",
      targetId: target.userId,
      metadata: { reason: cleanReason },
    },
  });

  revalidatePath(`/channels/${member.guildId}`);
  await dispatchGuildEvent(member.guildId, "GUILD_MEMBER_UPDATE", { userId: target.userId });
  return action;
}

export async function timeoutGuildMember(
  memberId: string,
  durationSeconds: number,
  reason?: string | null,
) {
  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { guildId: true },
  });
  if (!member) throw new Error("Membro não encontrado.");

  const { actor, target } = await assertCanModerate(member.guildId, memberId, Permissions.MODERATE_MEMBERS);
  const expiresAt = new Date(Date.now() + Math.max(60, Math.min(2_419_200, Math.trunc(durationSeconds))) * 1000);
  const cleanReason = reason?.trim().slice(0, 1000) || null;

  const action = await db.moderationAction.create({
    data: {
      guildId: member.guildId,
      targetUserId: target.userId,
      moderatorId: actor.id,
      type: "TIMEOUT",
      reason: cleanReason,
      expiresAt,
    },
  });

  await db.auditLog.create({
    data: {
      guildId: member.guildId,
      actorId: actor.id,
      action: "MEMBER_TIMEOUT",
      targetId: target.userId,
      metadata: { reason: cleanReason, expiresAt: expiresAt.toISOString() },
    },
  });

  revalidatePath(`/channels/${member.guildId}`);
  await dispatchGuildEvent(member.guildId, "GUILD_MEMBER_UPDATE", { userId: target.userId, timeoutUntil: expiresAt.toISOString() });
  return action;
}

export async function createGuildSticker(
  guildId: string,
  values: { name: string; description?: string | null; url: string },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_EXPRESSIONS);
  const name = values.name.trim();
  if (!EMOJI_RE.test(name)) throw new Error("Nome de sticker inválido.");
  if (!values.url.trim()) throw new Error("Envie uma imagem para o sticker.");

  const sticker = await db.sticker.create({
    data: {
      guildId,
      creatorId: actor.id,
      name,
      description: values.description?.trim().slice(0, 200) || null,
      url: values.url.trim(),
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "STICKER_CREATE",
      targetId: sticker.id,
      metadata: { name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  return sticker;
}

export async function createSoundboardSound(
  guildId: string,
  values: { name: string; emoji?: string | null; url: string; durationSeconds?: number; volume?: number },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_EXPRESSIONS);
  const name = values.name.trim();
  if (!EMOJI_RE.test(name)) throw new Error("Nome do som inválido.");
  if (!values.url.trim()) throw new Error("Envie um áudio para o soundboard.");

  const sound = await db.soundboardSound.create({
    data: {
      guildId,
      creatorId: actor.id,
      name,
      emoji: values.emoji?.trim().slice(0, 32) || null,
      url: values.url.trim(),
      durationSeconds: Math.max(1, Math.min(15, Math.trunc(values.durationSeconds ?? 5))),
      volume: Math.max(0, Math.min(1, Number(values.volume ?? 1))),
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "SOUNDBOARD_SOUND_CREATE",
      targetId: sound.id,
      metadata: { name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  return sound;
}

async function templateCode() {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(5).toString("base64url");
    const exists = await db.serverTemplate.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new Error("Não foi possível gerar o código do template.");
}

export async function createServerTemplate(
  guildId: string,
  values: { name: string; description?: string | null; public?: boolean },
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_GUILD);
  const guild = await db.guild.findUnique({
    where: { id: guildId },
    include: {
      roles: { orderBy: { position: "asc" } },
      categories: { orderBy: { position: "asc" } },
      channels: { orderBy: { position: "asc" } },
      onboarding: true,
      autoModRules: true,
    },
  });
  if (!guild) throw new Error("Servidor não encontrado.");

  const name = values.name.trim().replace(/\s+/g, " ").slice(0, 100);
  if (!name) throw new Error("Nome do template inválido.");

  const template = await db.serverTemplate.create({
    data: {
      guildId,
      creatorId: actor.id,
      name,
      description: values.description?.trim().slice(0, 2000) || null,
      public: Boolean(values.public),
      code: await templateCode(),
      snapshot: {
        name: guild.name,
        roles: guild.roles.map((role) => ({
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          permissions: role.permissions.toString(),
          mentionable: role.mentionable,
          isDefault: role.isDefault,
          managed: role.managed,
        })),
        categories: guild.categories.map(({ id, name, position }) => ({ id, name, position })),
        channels: guild.channels.map((channel) => ({
          name: channel.name,
          type: channel.type,
          position: channel.position,
          topic: channel.topic,
          nsfw: channel.nsfw,
          bitrate: channel.bitrate,
          userLimit: channel.userLimit,
          categoryId: channel.categoryId,
          parentId: channel.parentId,
        })),
        onboarding: guild.onboarding,
        autoModRules: guild.autoModRules,
      } as Prisma.InputJsonObject,
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "SERVER_TEMPLATE_CREATE",
      targetId: template.id,
      metadata: { name },
    },
  });

  return template;
}

function cleanCategoryName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > 100) throw new Error("Nome da categoria inválido.");
  return name;
}

export async function createGuildCategory(guildId: string, name: string) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_CHANNELS);
  const maximum = await db.category.aggregate({
    where: { guildId },
    _max: { position: true },
  });

  const category = await db.category.create({
    data: {
      guildId,
      name: cleanCategoryName(name),
      position: (maximum._max.position ?? -1) + 1,
    },
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: actor.id,
      action: "CATEGORY_CREATE",
      targetId: category.id,
      metadata: { name: category.name },
    },
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "CHANNEL_CREATE", {
    category,
    categoryId: category.id,
    categoryEvent: "CATEGORY_CREATE",
  });
  return category;
}

export async function renameGuildCategory(categoryId: string, name: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, guildId: true },
  });
  if (!category) throw new Error("Categoria não encontrada.");

  const actor = await requirePermission(category.guildId, Permissions.MANAGE_CHANNELS);
  const updated = await db.category.update({
    where: { id: categoryId },
    data: { name: cleanCategoryName(name) },
  });

  await db.auditLog.create({
    data: {
      guildId: category.guildId,
      actorId: actor.id,
      action: "CATEGORY_UPDATE",
      targetId: category.id,
      metadata: { name: updated.name },
    },
  });

  revalidatePath(`/channels/${category.guildId}`);
  await dispatchGuildEvent(category.guildId, "CHANNEL_UPDATE", {
    category: updated,
    categoryId: updated.id,
    categoryEvent: "CATEGORY_UPDATE",
  });
  return updated;
}

export async function deleteGuildCategory(categoryId: string) {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, guildId: true, name: true },
  });
  if (!category) throw new Error("Categoria não encontrada.");

  const actor = await requirePermission(category.guildId, Permissions.MANAGE_CHANNELS);
  await db.category.delete({ where: { id: category.id } });
  await db.auditLog.create({
    data: {
      guildId: category.guildId,
      actorId: actor.id,
      action: "CATEGORY_DELETE",
      targetId: category.id,
      metadata: { name: category.name },
    },
  });

  revalidatePath(`/channels/${category.guildId}`);
  await dispatchGuildEvent(category.guildId, "CHANNEL_DELETE", {
    categoryId: category.id,
    categoryEvent: "CATEGORY_DELETE",
  });
  return true;
}

export async function transferGuildOwnership(guildId: string, newOwnerUserId: string) {
  const { user } = await requireGuildMember(guildId);
  const guild = await db.guild.findUnique({
    where: { id: guildId },
    select: { ownerId: true },
  });
  if (!guild) throw new Error("Servidor não encontrado.");
  if (guild.ownerId !== user.id) throw new Error("Somente o dono pode transferir o servidor.");
  if (newOwnerUserId === user.id) throw new Error("Você já é o dono do servidor.");

  const target = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: newOwnerUserId,
        guildId,
      },
    },
    select: {
      userId: true,
      user: { select: { bot: { select: { id: true } } } },
    },
  });
  if (!target) throw new Error("O novo dono precisa ser membro do servidor.");
  if (target.user.bot) throw new Error("A propriedade do servidor não pode ser transferida para um bot.");

  await db.$transaction([
    db.guild.update({
      where: { id: guildId },
      data: { ownerId: newOwnerUserId },
    }),
    db.auditLog.create({
      data: {
        guildId,
        actorId: user.id,
        action: "GUILD_OWNERSHIP_TRANSFER",
        targetId: newOwnerUserId,
      },
    }),
  ]);

  await invalidateGuildUsers(guildId);
  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "GUILD_UPDATE", {
    ownerId: newOwnerUserId,
  });
  return true;
}

export async function leaveGuild(guildId: string) {
  const { user, member } = await requireGuildMember(guildId);
  if (member.guild.ownerId === user.id) {
    throw new Error("Transfira a propriedade ou exclua o servidor antes de sair.");
  }

  await db.member.delete({ where: { id: member.id } });
  await redis.del(`user:${user.id}:guilds`);
  revalidatePath("/");
  await dispatchGuildEvent(guildId, "GUILD_MEMBER_REMOVE", {
    userId: user.id,
    memberId: member.id,
  });
  return true;
}

export async function deleteGuildPermanently(guildId: string, confirmationName: string) {
  const { user } = await requireGuildMember(guildId);
  const guild = await db.guild.findUnique({
    where: { id: guildId },
    select: { id: true, name: true, ownerId: true },
  });

  if (!guild) throw new Error("Servidor não encontrado.");
  if (guild.ownerId !== user.id) throw new Error("Somente o dono pode excluir o servidor.");
  if (confirmationName.trim() !== guild.name) throw new Error("O nome de confirmação não corresponde ao servidor.");

  const memberIds = await db.member.findMany({
    where: { guildId },
    select: { userId: true },
  });

  await db.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({ where: { guildId } });
    await tx.guild.delete({ where: { id: guildId } });
  });

  if (memberIds.length) {
    await redis.del(...memberIds.map((member) => `user:${member.userId}:guilds`));
  }

  revalidatePath("/");
  await dispatchGuildEvent(guildId, "GUILD_DELETE", {
    guildId,
  });
  return true;
}
