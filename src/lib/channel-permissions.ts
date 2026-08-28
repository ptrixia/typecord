import { db } from "@/lib/db";
import {
  Permissions,
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";

export async function getEffectiveChannelPermissions(
  guildId: string,
  userId: string,
  channelId?: string,
): Promise<bigint> {
  const guild = await db.guild.findUnique({
    where: { id: guildId },
    select: {
      ownerId: true,
      roles: {
        where: { isDefault: true },
        select: { id: true, permissions: true },
        take: 1,
      },
      members: {
        where: { userId },
        select: {
          id: true,
          roles: {
            select: { id: true, permissions: true },
          },
        },
        take: 1,
      },
    },
  });

  if (!guild) {
    return 0n;
  }

  if (guild.ownerId === userId) {
    return Permissions.ADMINISTRATOR;
  }

  const member = guild.members[0];
  if (!member) {
    return 0n;
  }

  const everyoneRole = guild.roles[0];
  let permissions = normalizePermissions(everyoneRole?.permissions);

  for (const role of member.roles) {
    permissions |= normalizePermissions(role.permissions);
  }

  if (hasPermission(permissions, Permissions.ADMINISTRATOR)) {
    return Permissions.ADMINISTRATOR;
  }

  if (!channelId) {
    return permissions;
  }

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { guildId: true },
  });

  if (!channel || channel.guildId !== guildId) {
    return 0n;
  }

  const overwrites = await db.permissionOverwrite.findMany({
    where: { channelId },
    select: {
      roleId: true,
      memberId: true,
      allow: true,
      deny: true,
    },
  });

  const everyoneOverwrite = overwrites.find(
    (overwrite) => overwrite.roleId === everyoneRole?.id,
  );

  if (everyoneOverwrite) {
    permissions &= ~normalizePermissions(everyoneOverwrite.deny);
    permissions |= normalizePermissions(everyoneOverwrite.allow);
  }

  const memberRoleIds = new Set(member.roles.map((role) => role.id));
  let roleDeny = 0n;
  let roleAllow = 0n;

  for (const overwrite of overwrites) {
    if (overwrite.roleId && memberRoleIds.has(overwrite.roleId)) {
      roleDeny |= normalizePermissions(overwrite.deny);
      roleAllow |= normalizePermissions(overwrite.allow);
    }
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  const memberOverwrite = overwrites.find(
    (overwrite) => overwrite.memberId === member.id,
  );

  if (memberOverwrite) {
    permissions &= ~normalizePermissions(memberOverwrite.deny);
    permissions |= normalizePermissions(memberOverwrite.allow);
  }

  return permissions;
}

export async function canUserAccessChannel(
  userId: string,
  channelId: string,
  requiredPermissions: readonly bigint[] = [Permissions.VIEW_CHANNEL],
): Promise<boolean> {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { guildId: true },
  });

  if (!channel) {
    return false;
  }

  const permissions = await getEffectiveChannelPermissions(
    channel.guildId,
    userId,
    channelId,
  );

  return requiredPermissions.every((permission) =>
    hasPermission(permissions, permission),
  );
}

export async function getBotIdsWithChannelAccess(
  guildId: string,
  channelId: string,
  options?: { excludeBotId?: string },
): Promise<string[]> {
  const members = await db.member.findMany({
    where: {
      guildId,
      user: {
        bot: {
          isNot: null,
        },
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          bot: {
            select: {
              id: true,
              disabled: true,
            },
          },
        },
      },
    },
  });

  const checks = await Promise.all(
    members.map(async (member) => {
      const bot = member.user.bot;

      if (!bot || bot.disabled || bot.id === options?.excludeBotId) {
        return null;
      }

      const permissions = await getEffectiveChannelPermissions(
        guildId,
        member.userId,
        channelId,
      );

      return hasPermission(permissions, Permissions.VIEW_CHANNEL)
        ? bot.id
        : null;
    }),
  );

  return checks.filter((botId): botId is string => Boolean(botId));
}
