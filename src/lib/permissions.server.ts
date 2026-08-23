import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

import {
  Permissions,
  hasPermission,
  normalizePermissions,
} from "./permissions";

/**
 * Retorna o membro de uma guild.
 */
export async function getGuildMember(
  guildId: string,
  userId: string,
) {
  return db.member.findUnique({
    where: {
      userId_guildId: {
        userId,
        guildId,
      },
    },

    include: {
      roles: {
        orderBy: {
          position: "desc",
        },
      },

      user: {
        select: {
          id: true,
          username: true,
          globalName: true,
          avatarUrl: true,
          status: true,
        },
      },
    },
  });
}

/**
 * Retorna o maior cargo que o membro possui.
 *
 * @everyone normalmente está na posição 0.
 */
export async function getHighestRole(
  guildId: string,
  userId: string,
) {
  const member = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId,
        guildId,
      },
    },

    select: {
      roles: {
        orderBy: {
          position: "desc",
        },

        select: {
          id: true,
          name: true,
          position: true,
          permissions: true,
          isDefault: true,
          managed: true,
        },
      },
    },
  });

  if (!member) {
    return null;
  }

  return member.roles[0] ?? null;
}

/**
 * Calcula as permissões efetivas de um membro.
 *
 * Ordem:
 *
 * 1. Proprietário
 * 2. @everyone
 * 3. Cargos
 * 4. Overwrite @everyone
 * 5. Overwrites de cargos
 * 6. Overwrite específico do membro
 *
 * Administrador ignora os permission overwrites.
 */
export async function getEffectivePermissions(
  guildId: string,
  userId: string,
  channelId?: string,
): Promise<bigint> {
  const guild = await db.guild.findUnique({
    where: {
      id: guildId,
    },

    select: {
      ownerId: true,

      roles: {
        where: {
          isDefault: true,
        },

        select: {
          id: true,
          permissions: true,
        },

        take: 1,
      },

      members: {
        where: {
          userId,
        },

        select: {
          id: true,

          roles: {
            select: {
              id: true,
              permissions: true,
            },
          },
        },

        take: 1,
      },
    },
  });

  if (!guild) {
    return 0n;
  }

  /**
   * O dono possui todas as permissões.
   */
  if (guild.ownerId === userId) {
    return Permissions.ADMINISTRATOR;
  }

  const member = guild.members[0];

  if (!member) {
    return 0n;
  }

  const everyoneRole = guild.roles[0];

  /**
   * Começamos com as permissões de @everyone.
   */
  let permissions = normalizePermissions(
    everyoneRole?.permissions,
  );

  /**
   * Somamos as permissões de todos os cargos.
   */
  for (const role of member.roles) {
    permissions |= normalizePermissions(role.permissions);
  }

  /**
   * Administrador ignora todos os overwrites.
   */
  if (
    (permissions & Permissions.ADMINISTRATOR) !==
    0n
  ) {
    return Permissions.ADMINISTRATOR;
  }

  /**
   * Sem canal, as permissões do servidor são suficientes.
   */
  if (!channelId) {
    return permissions;
  }

  /**
   * Garante que o canal pertence à guild.
   */
  const channel = await db.channel.findUnique({
    where: {
      id: channelId,
    },

    select: {
      guildId: true,
    },
  });

  if (!channel || channel.guildId !== guildId) {
    return permissions;
  }

  /**
   * Busca os permission overwrites.
   */
  const overwrites =
    await db.permissionOverwrite.findMany({
      where: {
        channelId,
      },

      select: {
        roleId: true,
        memberId: true,
        allow: true,
        deny: true,
      },
    });

  /**
   * --------------------------------------------------
   * @everyone overwrite
   * --------------------------------------------------
   */
  const everyoneOverwrite = overwrites.find(
    (overwrite) =>
      overwrite.roleId === everyoneRole?.id,
  );

  if (everyoneOverwrite) {
    permissions &=
      ~normalizePermissions(
        everyoneOverwrite.deny,
      );

    permissions |= normalizePermissions(
      everyoneOverwrite.allow,
    );
  }

  /**
   * --------------------------------------------------
   * Role overwrites
   * --------------------------------------------------
   *
   * Discord combina:
   *
   * deny = OR de todos os denies
   * allow = OR de todos os allows
   */
  const memberRoleIds = new Set(
    member.roles.map((role) => role.id),
  );

  const roleOverwrites = overwrites.filter(
    (overwrite) =>
      overwrite.roleId !== null &&
      memberRoleIds.has(overwrite.roleId),
  );

  let roleDeny = 0n;
  let roleAllow = 0n;

  for (const overwrite of roleOverwrites) {
    roleDeny |= normalizePermissions(
      overwrite.deny,
    );

    roleAllow |= normalizePermissions(
      overwrite.allow,
    );
  }

  permissions &= ~roleDeny;
  permissions |= roleAllow;

  /**
   * --------------------------------------------------
   * Member-specific overwrite
   * --------------------------------------------------
   */
  const memberOverwrite = overwrites.find(
    (overwrite) =>
      overwrite.memberId === member.id,
  );

  if (memberOverwrite) {
    permissions &=
      ~normalizePermissions(memberOverwrite.deny);

    permissions |= normalizePermissions(
      memberOverwrite.allow,
    );
  }

  return permissions;
}

/**
 * Exige que o usuário esteja autenticado e possua
 * determinada permissão.
 */
export async function requirePermission(
  guildId: string,
  permission: bigint,
  channelId?: string,
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const permissions =
    await getEffectivePermissions(
      guildId,
      user.id,
      channelId,
    );

  if (!hasPermission(permissions, permission)) {
    throw new Error(
      "Você não tem permissão para realizar esta ação.",
    );
  }

  return user;
}

/**
 * Exige permissão para gerenciar cargos.
 *
 * Também respeita a hierarquia:
 *
 * usuário
 *   ↓
 * maior cargo
 *   ↓
 * cargo alvo
 *
 * Um usuário não consegue administrar um cargo
 * que esteja acima ou no mesmo nível que seu maior cargo.
 */
export async function requireRoleManagement(
  guildId: string,
  targetRoleId?: string,
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const guild = await db.guild.findUnique({
    where: {
      id: guildId,
    },

    select: {
      ownerId: true,

      members: {
        where: {
          userId: user.id,
        },

        select: {
          roles: {
            orderBy: {
              position: "desc",
            },

            select: {
              id: true,
              position: true,
              permissions: true,
              isDefault: true,
              managed: true,
            },
          },
        },

        take: 1,
      },
    },
  });

  if (!guild) {
    throw new Error("Servidor não encontrado.");
  }

  /**
   * O proprietário pode gerenciar todos os cargos.
   */
  if (guild.ownerId === user.id) {
    return {
      user,
      guild,
      topPosition: Number.MAX_SAFE_INTEGER,
    };
  }

  const member = guild.members[0];

  if (!member) {
    throw new Error(
      "Você não é membro deste servidor.",
    );
  }

  /**
   * Calcula permissões do membro.
   */
  let permissions = 0n;

  for (const role of member.roles) {
    permissions |= normalizePermissions(
      role.permissions,
    );
  }

  /**
   * Sem MANAGE_ROLES não pode administrar cargos.
   */
  if (
    !hasPermission(
      permissions,
      Permissions.MANAGE_ROLES,
    )
  ) {
    throw new Error(
      "Você não tem a permissão Gerenciar Cargos.",
    );
  }

  /**
   * O maior cargo do membro.
   */
  const topRole = member.roles[0];

  const topPosition = topRole?.position ?? 0;

  /**
   * Se não estamos verificando um cargo específico,
   * já podemos retornar.
   */
  if (!targetRoleId) {
    return {
      user,
      guild,
      topPosition,
    };
  }

  /**
   * Busca o cargo alvo.
   */
  const targetRole = await db.role.findUnique({
    where: {
      id: targetRoleId,
    },

    select: {
      guildId: true,
      position: true,
      isDefault: true,
      managed: true,
    },
  });

  if (
    !targetRole ||
    targetRole.guildId !== guildId
  ) {
    throw new Error("Cargo inválido.");
  }

  /**
   * @everyone nunca pode ser alterado como cargo normal.
   */
  if (targetRole.isDefault) {
    throw new Error(
      "O cargo @everyone não pode ser gerenciado dessa forma.",
    );
  }

  /**
   * Cargos gerenciados pelo sistema também não.
   */
  if (targetRole.managed) {
    throw new Error(
      "Este cargo é gerenciado pelo sistema.",
    );
  }

  /**
   * Hierarquia:
   *
   * target >= top
   *
   * significa que o cargo está no mesmo nível
   * ou acima do usuário.
   */
  if (targetRole.position >= topPosition) {
    throw new Error(
      "Você só pode gerenciar cargos abaixo do seu cargo mais alto.",
    );
  }

  return {
    user,
    guild,
    topPosition,
  };
}