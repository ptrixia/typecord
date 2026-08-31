import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  ALL_PERMISSIONS,
  Permissions,
  getPermissionNames,
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";
import {
  getEffectivePermissions,
  getHighestRole,
  requirePermission,
} from "@/lib/permissions.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

class RouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const roleSchema = z.object({
  roleId: z.string().min(1),
});

const overwriteSchema = roleSchema.extend({
  allow: z.string().regex(/^\d+$/).max(32),
  deny: z.string().regex(/^\d+$/).max(32),
});

async function getChannel(channelId: string) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true, name: true, type: true },
  });

  if (!channel) {
    throw new RouteError("Canal não encontrado.", 404);
  }

  return channel;
}

async function authorizeRoleChange(channelId: string, roleId: string) {
  const channel = await getChannel(channelId);
  const actor = await requirePermission(
    channel.guildId,
    Permissions.MANAGE_CHANNELS,
    channel.id,
  );
  await requirePermission(
    channel.guildId,
    Permissions.MANAGE_ROLES,
    channel.id,
  );

  const [role, guild, highestRole] = await Promise.all([
    db.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        guildId: true,
        name: true,
        position: true,
        isDefault: true,
        managed: true,
      },
    }),
    db.guild.findUnique({
      where: { id: channel.guildId },
      select: { ownerId: true },
    }),
    getHighestRole(channel.guildId, actor.id),
  ]);

  if (!role || role.guildId !== channel.guildId) {
    throw new RouteError("Cargo inválido.", 400);
  }

  if (role.managed) {
    throw new RouteError("Este cargo é gerenciado pelo sistema.", 400);
  }

  if (
    guild?.ownerId !== actor.id &&
    !role.isDefault &&
    (!highestRole || role.position >= highestRole.position)
  ) {
    throw new RouteError(
      "Você só pode editar permissões de cargos abaixo do seu maior cargo.",
      403,
    );
  }

  return { actor, channel, role };
}

function handleError(error: unknown, operation: string) {
  if (error instanceof RouteError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof Error) {
    if (error.message === "Não autorizado.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message.includes("permissão")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  console.error(`[CHANNEL_PERMISSIONS_${operation}]`, error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params;
    const channel = await getChannel(channelId);
    const currentUser = await getCurrentUser();
    const requestUrl = new URL(_request.url);
    if (requestUrl.searchParams.get("check") === "send") {
      if (!currentUser) return NextResponse.json({ canSendMessages: false }, { status: 401 });
      const effectivePermissions = await getEffectivePermissions(channel.guildId, currentUser.id, channel.id);
      return NextResponse.json({
        canSendMessages:
          hasPermission(effectivePermissions, Permissions.VIEW_CHANNEL) &&
          hasPermission(effectivePermissions, Permissions.READ_MESSAGE_HISTORY) &&
          hasPermission(effectivePermissions, Permissions.SEND_MESSAGES),
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const actor = await requirePermission(
      channel.guildId,
      Permissions.MANAGE_CHANNELS,
      channel.id,
    );

    const effectivePermissions = await getEffectivePermissions(
      channel.guildId,
      actor.id,
      channel.id,
    );
    const [roles, overwrites] = await Promise.all([
      db.role.findMany({
        where: { guildId: channel.guildId },
        orderBy: { position: "desc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true,
          permissions: true,
          isDefault: true,
          managed: true,
        },
      }),
      db.permissionOverwrite.findMany({
        where: { channelId: channel.id, roleId: { not: null } },
        select: { id: true, roleId: true, allow: true, deny: true },
      }),
    ]);

    return NextResponse.json({
      channel,
      roles: roles.sort(
        (left, right) =>
          Number(right.isDefault) - Number(left.isDefault) ||
          right.position - left.position,
      ),
      overwrites,
      canEditPermissions: hasPermission(
        effectivePermissions,
        Permissions.MANAGE_ROLES,
      ),
    });
  } catch (error) {
    return handleError(error, "GET");
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params;
    const rawBody = await request.json().catch(() => null);
    const parsedBody = overwriteSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Permission overwrite inválido." },
        { status: 400 },
      );
    }

    const { roleId } = parsedBody.data;
    const allow = normalizePermissions(parsedBody.data.allow) & ALL_PERMISSIONS;
    const deny = normalizePermissions(parsedBody.data.deny) & ALL_PERMISSIONS;

    if ((allow & deny) !== 0n) {
      return NextResponse.json(
        {
          error:
            "Uma permissão não pode ser permitida e negada ao mesmo tempo.",
        },
        { status: 400 },
      );
    }

    const { actor, channel, role } = await authorizeRoleChange(
      channelId,
      roleId,
    );

    const overwrite = await db.$transaction(async (transaction) => {
      if (allow === 0n && deny === 0n) {
        await transaction.permissionOverwrite.deleteMany({
          where: { channelId: channel.id, roleId: role.id },
        });
        await transaction.auditLog.create({
          data: {
            guildId: channel.guildId,
            actorId: actor.id,
            action: "CHANNEL_PERMISSION_RESET",
            targetId: channel.id,
            metadata: { roleId: role.id, roleName: role.name },
          },
        });
        return null;
      }

      const saved = await transaction.permissionOverwrite.upsert({
        where: {
          channelId_roleId: { channelId: channel.id, roleId: role.id },
        },
        create: {
          channelId: channel.id,
          roleId: role.id,
          allow: allow.toString(),
          deny: deny.toString(),
        },
        update: {
          allow: allow.toString(),
          deny: deny.toString(),
        },
      });

      await transaction.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: actor.id,
          action: "CHANNEL_PERMISSION_UPDATE",
          targetId: channel.id,
          metadata: {
            roleId: role.id,
            roleName: role.name,
            allow: allow.toString(),
            deny: deny.toString(),
            allowedPermissions: getPermissionNames(allow),
            deniedPermissions: getPermissionNames(deny),
          },
        },
      });

      return saved;
    });

    revalidatePath(`/channels/${channel.guildId}`);
    return NextResponse.json({ overwrite });
  } catch (error) {
    return handleError(error, "PUT");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { channelId } = await context.params;
    const rawBody = await request.json().catch(() => null);
    const parsedBody = roleSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Cargo inválido." }, { status: 400 });
    }

    const { actor, channel, role } = await authorizeRoleChange(
      channelId,
      parsedBody.data.roleId,
    );

    await db.$transaction(async (transaction) => {
      await transaction.permissionOverwrite.deleteMany({
        where: { channelId: channel.id, roleId: role.id },
      });
      await transaction.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: actor.id,
          action: "CHANNEL_PERMISSION_RESET",
          targetId: channel.id,
          metadata: { roleId: role.id, roleName: role.name },
        },
      });
    });

    revalidatePath(`/channels/${channel.guildId}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, "DELETE");
  }
}
