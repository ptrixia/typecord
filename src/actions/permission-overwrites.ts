"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Permissions as PERMISSIONS, type PermissionName } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

function bitfieldFromNames(names: PermissionName[]) {
  let value = 0n;
  for (const name of names) value |= PERMISSIONS[name];
  return value.toString();
}

function validatePermissionBitfield(value: string) {
  try {
    return BigInt(value).toString();
  } catch {
    return "0";
  }
}

export async function setChannelPermissionOverwrite(
  channelId: string,
  target: { roleId?: string; memberId?: string },
  allow: string,
  deny: string,
) {
  if ((target.roleId ? 1 : 0) + (target.memberId ? 1 : 0) !== 1) {
    throw new Error("Um overwrite deve apontar para um cargo ou para um membro.");
  }

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });
  if (!channel) throw new Error("Canal não encontrado.");

  const ctx = await requirePermission(channel.guildId, PERMISSIONS.MANAGE_CHANNELS);

  const safeAllow = validatePermissionBitfield(allow);
  const safeDeny = validatePermissionBitfield(deny);

  const overwrite = await db.permissionOverwrite.upsert({
    where: target.roleId
      ? { channelId_roleId: { channelId, roleId: target.roleId } }
      : { channelId_memberId: { channelId, memberId: target.memberId! } },
    create: {
      channelId,
      roleId: target.roleId,
      memberId: target.memberId,
      allow: safeAllow,
      deny: safeDeny,
    },
    update: {
      allow: safeAllow,
      deny: safeDeny,
    },
  });

  await db.auditLog.create({
    data: {
      guildId: channel.guildId,
      actorId: ctx.id,
      action: "CHANNEL_OVERWRITE_UPDATE",
      targetId: channelId,
      metadata: { ...target, allow: safeAllow, deny: safeDeny },
    },
  });

  revalidatePath(`/channels/${channel.guildId}`);
  return overwrite;
}

export async function deleteChannelPermissionOverwrite(
  channelId: string,
  target: { roleId?: string; memberId?: string },
) {
  if ((target.roleId ? 1 : 0) + (target.memberId ? 1 : 0) !== 1) {
    throw new Error("Alvo de overwrite inválido.");
  }

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });
  if (!channel) throw new Error("Canal não encontrado.");

  const ctx = await requirePermission(channel.guildId, PERMISSIONS.MANAGE_CHANNELS);

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
      actorId: ctx.id,
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
    select: {
      id: true,
      guildId: true,
      permissionOverwrites: true,
    },
  });
  if (!channel) throw new Error("Canal não encontrado.");

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      guildId: true,
      roles: { select: { id: true, permissions: true } },
      userId: true,
      guild: {
        select: {
          ownerId: true,
          roles: {
            where: { isDefault: true },
            select: { id: true, permissions: true },
          },
        },
      },
    },
  });

  if (!member || member.guildId !== channel.guildId) throw new Error("Membro não encontrado.");

  if (member.guild.ownerId === member.userId) {
    return { permissions: ((1n << 63n) - 1n).toString(), isAdministrator: true };
  }

  const everyone = member.guild.roles[0];
  let permissions = BigInt(everyone?.permissions ?? "0");

  for (const role of member.roles) {
    permissions |= BigInt(role.permissions);
  }

  const isAdministrator = (permissions & PERMISSIONS.ADMINISTRATOR) === PERMISSIONS.ADMINISTRATOR;
  if (isAdministrator) {
    return { permissions: permissions.toString(), isAdministrator: true };
  }

  const roleIds = member.roles.map((role) => role.id);
  const roleOverwrites = channel.permissionOverwrites.filter(
    (overwrite) => overwrite.roleId && (overwrite.roleId === everyone?.id || roleIds.includes(overwrite.roleId)),
  );

  let roleDeny = 0n;
  let roleAllow = 0n;
  for (const overwrite of roleOverwrites) {
    roleDeny |= BigInt(overwrite.deny);
    roleAllow |= BigInt(overwrite.allow);
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  const memberOverwrite = channel.permissionOverwrites.find(
    (overwrite) => overwrite.memberId === memberId,
  );

  if (memberOverwrite) {
    permissions &= ~BigInt(memberOverwrite.deny);
    permissions |= BigInt(memberOverwrite.allow);
  }

  return {
    permissions: permissions.toString(),
    isAdministrator: false,
  };
}

export function permissionBitfieldFromNames(names: PermissionName[]) {
  return bitfieldFromNames(names);
}