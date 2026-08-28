"use server";

import { revalidatePath } from "next/cache";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { db } from "@/lib/db";
import {
  ALL_PERMISSIONS,
  Permissions,
  hasPermission,
  sanitizePermissions,
  type PermissionName,
} from "@/lib/permissions";
import {
  requirePermission,
  requireRoleManagement,
} from "@/lib/permissions.server";

function bitfieldFromNames(names: PermissionName[]) {
  let value = 0n;
  for (const name of names) value |= Permissions[name];
  return value.toString();
}

function validatePermissionBitfield(value: string) {
  if (!/^\d{1,32}$/.test(value)) {
    throw new Error("Bitfield de permissão inválido.");
  }

  const sanitized = sanitizePermissions(value);
  if (sanitized < 0n || (sanitized & ~ALL_PERMISSIONS) !== 0n) {
    throw new Error("Bitfield de permissão inválido.");
  }

  return sanitized;
}

async function validateTarget(
  guildId: string,
  target: { roleId?: string; memberId?: string },
) {
  if ((target.roleId ? 1 : 0) + (target.memberId ? 1 : 0) !== 1) {
    throw new Error("Um overwrite deve apontar para um cargo ou para um membro.");
  }

  if (target.roleId) {
    const role = await db.role.findUnique({
      where: { id: target.roleId },
      select: { id: true, guildId: true, isDefault: true, managed: true },
    });

    if (!role || role.guildId !== guildId) {
      throw new Error("Cargo inválido para este servidor.");
    }

    if (role.managed) {
      throw new Error("Este cargo é gerenciado pelo sistema.");
    }

    if (!role.isDefault) {
      await requireRoleManagement(guildId, role.id);
    } else {
      await requirePermission(guildId, Permissions.MANAGE_ROLES);
    }

    return;
  }

  const member = await db.member.findUnique({
    where: { id: target.memberId! },
    select: { guildId: true },
  });

  if (!member || member.guildId !== guildId) {
    throw new Error("Membro inválido para este servidor.");
  }
}

export async function setChannelPermissionOverwrite(
  channelId: string,
  target: { roleId?: string; memberId?: string },
  allow: string,
  deny: string,
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });

  if (!channel) throw new Error("Canal não encontrado.");

  const actor = await requirePermission(
    channel.guildId,
    Permissions.MANAGE_CHANNELS,
    channel.id,
  );

  await validateTarget(channel.guildId, target);

  const safeAllow = validatePermissionBitfield(allow);
  const safeDeny = validatePermissionBitfield(deny);

  if ((safeAllow & safeDeny) !== 0n) {
    throw new Error("A mesma permissão não pode estar em allow e deny.");
  }

  const overwrite = await db.permissionOverwrite.upsert({
    where: target.roleId
      ? { channelId_roleId: { channelId, roleId: target.roleId } }
      : { channelId_memberId: { channelId, memberId: target.memberId! } },
    create: {
      channelId,
      roleId: target.roleId,
      memberId: target.memberId,
      allow: safeAllow.toString(),
      deny: safeDeny.toString(),
    },
    update: {
      allow: safeAllow.toString(),
      deny: safeDeny.toString(),
    },
  });

  await db.auditLog.create({
    data: {
      guildId: channel.guildId,
      actorId: actor.id,
      action: "CHANNEL_OVERWRITE_UPDATE",
      targetId: channelId,
      metadata: {
        ...target,
        allow: safeAllow.toString(),
        deny: safeDeny.toString(),
      },
    },
  });

  revalidatePath(`/channels/${channel.guildId}`);
  return overwrite;
}

export async function deleteChannelPermissionOverwrite(
  channelId: string,
  target: { roleId?: string; memberId?: string },
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });

  if (!channel) throw new Error("Canal não encontrado.");

  const actor = await requirePermission(
    channel.guildId,
    Permissions.MANAGE_CHANNELS,
    channel.id,
  );

  await validateTarget(channel.guildId, target);

  if (target.roleId) {
    await db.permissionOverwrite.deleteMany({
      where: { channelId, roleId: target.roleId },
    });
  } else {
    await db.permissionOverwrite.deleteMany({
      where: { channelId, memberId: target.memberId! },
    });
  }

  await db.auditLog.create({
    data: {
      guildId: channel.guildId,
      actorId: actor.id,
      action: "CHANNEL_OVERWRITE_DELETE",
      targetId: channelId,
      metadata: target,
    },
  });

  revalidatePath(`/channels/${channel.guildId}`);
  return true;
}

export async function getChannelPermissionState(channelId: string, memberId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });

  if (!channel) throw new Error("Canal não encontrado.");

  await requirePermission(
    channel.guildId,
    Permissions.MANAGE_CHANNELS,
    channel.id,
  );

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: { id: true, guildId: true, userId: true },
  });

  if (!member || member.guildId !== channel.guildId) {
    throw new Error("Membro não encontrado.");
  }

  const permissions = await getEffectiveChannelPermissions(
    channel.guildId,
    member.userId,
    channel.id,
  );

  return {
    permissions: permissions.toString(),
    isAdministrator: hasPermission(permissions, Permissions.ADMINISTRATOR),
  };
}

export function permissionBitfieldFromNames(names: PermissionName[]) {
  return bitfieldFromNames(names);
}
