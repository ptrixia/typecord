import { z } from "zod";
import { db } from "@/lib/db";
import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { hasPermission, Permissions } from "@/lib/permissions";

export const pluginManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-_.]{1,63}$/),
  name: z.string().trim().min(2).max(80),
  version: z.string().trim().min(1).max(32),
  description: z.string().trim().max(500).default(""),
  permissions: z.array(z.string().trim().min(1).max(80)).max(32).default([]),
  commands: z.array(z.object({
    name: z.string().regex(/^[a-z0-9-]{1,32}$/),
    description: z.string().trim().min(1).max(100),
    permissions: z.array(z.string().trim().min(1).max(80)).max(16).default([]),
  })).max(50).default([]),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

const plugins = new Map<string, PluginManifest>();

registerPlugin({
  id: "moderation-tools",
  name: "Ferramentas de moderação",
  version: "1.1.0",
  description: "Moderação rápida com advertências, timeout, expulsão, banimento, limpeza e auditoria.",
  permissions: ["MODERATE_MEMBERS", "VIEW_AUDIT_LOG", "KICK_MEMBERS", "BAN_MEMBERS", "MANAGE_MESSAGES"],
  commands: [
    { name: "warn", description: "Adverte um membro", permissions: ["MODERATE_MEMBERS"] },
    { name: "timeout", description: "Aplica timeout temporário", permissions: ["MODERATE_MEMBERS"] },
    { name: "kick", description: "Expulsa um membro", permissions: ["KICK_MEMBERS"] },
    { name: "ban", description: "Bane um membro", permissions: ["BAN_MEMBERS"] },
    { name: "unban", description: "Remove um banimento", permissions: ["BAN_MEMBERS"] },
    { name: "clear", description: "Limpa mensagens recentes", permissions: ["MANAGE_MESSAGES"] },
    { name: "slowmode", description: "Configura o modo lento do canal", permissions: ["MANAGE_CHANNELS"] },
    { name: "lock", description: "Bloqueia ou desbloqueia o canal", permissions: ["MANAGE_CHANNELS"] },
    { name: "history", description: "Consulta o histórico recente", permissions: ["VIEW_AUDIT_LOG"] },
  ],
});

export function registerPlugin(input: unknown) {
  const manifest = pluginManifestSchema.parse(input);
  plugins.set(manifest.id, manifest);
  return manifest;
}

export function listPlugins() {
  return [...plugins.values()];
}

export function getPlugin(id: string) {
  return plugins.get(id) ?? null;
}

export async function listInstalledPlugins(guildId: string) {
  const rows = await db.guildPluginInstallation.findMany({ where: { guildId }, orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({ ...row, manifest: getPlugin(row.pluginId) }));
}

export async function executePluginCommand(input: { guildId: string; channelId: string; userId: string; content: string }) {
  const match = input.content.trim().match(/^\/([a-z0-9-]{1,32})(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  const commandName = match[1].toLowerCase();
  const args = (match[2] ?? "").trim();
  const installations = await db.guildPluginInstallation.findMany({ where: { guildId: input.guildId, enabled: true } });
  const plugin = installations.map((row) => ({ row, manifest: getPlugin(row.pluginId) })).find(({ manifest }) => manifest?.commands.some((command) => command.name === commandName));
  if (!plugin?.manifest) return null;
  const command = plugin.manifest.commands.find((item) => item.name === commandName);

  const permissions = await getEffectiveChannelPermissions(input.guildId, input.userId, input.channelId);
  for (const required of command?.permissions?.length ? command.permissions : plugin.manifest.permissions) {
    const permission = Permissions[required as keyof typeof Permissions];
    if (typeof permission === "bigint" && !hasPermission(permissions, permission)) {
      throw new Error(`O plugin exige a permissão ${required}.`);
    }
  }

  const resolveTarget = async (value: string) => {
    const normalized = value.replace(/[<@!>]/g, "");
    return db.member.findFirst({
      where: { guildId: input.guildId, user: { OR: [{ id: normalized }, { username: normalized }, { globalName: normalized }] } },
      select: { id: true, userId: true, user: { select: { username: true, globalName: true } }, roles: { select: { position: true } } },
    });
  };

  const assertTarget = async (targetMemberId: string) => {
    const [guild, actorMember, target] = await Promise.all([
      db.guild.findUnique({ where: { id: input.guildId }, select: { ownerId: true } }),
      db.member.findUnique({ where: { userId_guildId: { userId: input.userId, guildId: input.guildId } }, select: { roles: { select: { position: true } } } }),
      db.member.findUnique({ where: { id: targetMemberId }, select: { userId: true, roles: { select: { position: true } }, user: { select: { username: true, globalName: true } } } }),
    ]);
    if (!guild || !actorMember || !target) throw new Error("Membro não encontrado.");
    if (target.userId === guild.ownerId || target.userId === input.userId) throw new Error("Você não pode moderar este membro.");
    const actorTop = guild.ownerId === input.userId ? Number.MAX_SAFE_INTEGER : Math.max(0, ...actorMember.roles.map((role) => role.position));
    const targetTop = Math.max(0, ...target.roles.map((role) => role.position));
    if (guild.ownerId !== input.userId && targetTop >= actorTop) throw new Error("O membro possui cargo igual ou superior ao seu.");
    return target;
  };

  const parseTargetAndReason = (value: string) => value.match(/^(@?[a-zA-Z0-9_.-]{2,64}|<@!?\d+>)(?:\s+([\s\S]+))?$/);

  if (plugin.manifest.id === "moderation-tools" && commandName === "warn") {
    const parsed = args.match(/^(.+?)\s+([\s\S]+)$/);
    if (!parsed) return "Uso: /warn @membro motivo";
    const found = await resolveTarget(parsed[1]);
    if (!found) return `Não encontrei o membro ${parsed[1]} neste servidor.`;
    const target = await assertTarget(found.id);
    const reason = parsed[2].slice(0, 1000);
    await db.$transaction([db.moderationAction.create({ data: { guildId: input.guildId, targetUserId: target.userId, moderatorId: input.userId, type: "WARNING", reason } }), db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "MEMBER_WARN", targetId: target.userId, metadata: { reason, source: plugin.manifest.id } } })]);
    return `⚠️ Advertência registrada para <@${target.userId}>.`;
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "timeout") {
    const parsed = args.match(/^(.+?)\s+(\d+)(s|m|h|d)(?:\s+([\s\S]+))?$/i);
    if (!parsed) return "Uso: /timeout @membro 10m motivo";
    const found = await resolveTarget(parsed[1]);
    if (!found) return `Não encontrei o membro ${parsed[1]} neste servidor.`;
    const target = await assertTarget(found.id);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[parsed[3].toLowerCase() as "s" | "m" | "h" | "d"];
    const seconds = Math.min(2_419_200, Math.max(60, Number(parsed[2]) * unit));
    const expiresAt = new Date(Date.now() + seconds * 1000);
    const reason = parsed[4]?.slice(0, 1000) || null;
    await db.$transaction([db.moderationAction.create({ data: { guildId: input.guildId, targetUserId: target.userId, moderatorId: input.userId, type: "TIMEOUT", reason, expiresAt } }), db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "MEMBER_TIMEOUT", targetId: target.userId, metadata: { reason, expiresAt: expiresAt.toISOString(), source: plugin.manifest.id } } })]);
    return `⏳ <@${target.userId}> ficará em timeout por ${parsed[2]}${parsed[3]}.`;
  }
  if (plugin.manifest.id === "moderation-tools" && (commandName === "kick" || commandName === "ban")) {
    const parsed = parseTargetAndReason(args);
    if (!parsed) return `Uso: /${commandName} @membro motivo`;
    const found = await resolveTarget(parsed[1]);
    if (!found) return `Não encontrei o membro ${parsed[1]} neste servidor.`;
    const target = await assertTarget(found.id);
    const reason = parsed[2]?.slice(0, 1000) || null;
    if (commandName === "ban") {
      await db.$transaction([db.guildBan.upsert({ where: { guildId_userId: { guildId: input.guildId, userId: target.userId } }, create: { guildId: input.guildId, userId: target.userId, reason }, update: { reason } }), db.member.delete({ where: { id: found.id } }), db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "MEMBER_BAN", targetId: target.userId, metadata: { reason, source: plugin.manifest.id } } })]);
      return `🔨 <@${target.userId}> foi banido.`;
    }
    await db.$transaction([
      db.member.delete({ where: { id: found.id } }),
      db.auditLog.create({
        data: {
          guildId: input.guildId,
          actorId: input.userId,
          action: "MEMBER_KICK",
          targetId: target.userId,
          metadata: { reason, source: plugin.manifest.id },
        },
      }),
    ]);
    return `👢 <@${target.userId}> foi expulso.`;
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "unban") {
    const target = await resolveTarget(args);
    const userId = target?.userId ?? args.replace(/[<@!>]/g, "");
    if (!userId) return "Uso: /unban @membro-ou-id";
    const removed = await db.guildBan.deleteMany({ where: { guildId: input.guildId, userId } });
    if (!removed.count) return "Não encontrei um banimento para esse usuário.";
    await db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "MEMBER_UNBAN", targetId: userId, metadata: { source: plugin.manifest.id } } });
    return `✅ Banimento de <@${userId}> removido.`;
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "slowmode") {
    const value = args.toLowerCase() === "off" ? 0 : Number(args);
    if (!Number.isInteger(value) || value < 0 || value > 21_600) return "Uso: /slowmode 0-21600 ou /slowmode off";
    await db.channel.update({ where: { id: input.channelId }, data: { slowmodeSeconds: value } });
    await db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "CHANNEL_SLOWMODE_UPDATE", targetId: input.channelId, metadata: { seconds: value, source: plugin.manifest.id } } });
    return value ? `🐢 Modo lento ativado: ${value}s.` : "🐢 Modo lento desativado.";
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "lock") {
    const value = args.toLowerCase() !== "off" && args.toLowerCase() !== "unlock";
    await db.channel.update({ where: { id: input.channelId }, data: { locked: value } });
    await db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: value ? "CHANNEL_LOCK" : "CHANNEL_UNLOCK", targetId: input.channelId, metadata: { source: plugin.manifest.id } } });
    return value ? "🔒 Canal bloqueado." : "🔓 Canal desbloqueado.";
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "clear") {
    const amount = Number(args);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) return "Uso: /clear 1-100";
    const messages = await db.message.findMany({ where: { channelId: input.channelId, deleted: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: amount, select: { id: true } });
    await db.message.updateMany({ where: { id: { in: messages.map((message) => message.id) } }, data: { deleted: true } });
    await db.auditLog.create({ data: { guildId: input.guildId, actorId: input.userId, action: "MESSAGE_BULK_DELETE", metadata: { count: messages.length, channelId: input.channelId, source: plugin.manifest.id } } });
    return `🧹 ${messages.length} mensagem(ns) removida(s).`;
  }
  if (plugin.manifest.id === "moderation-tools" && commandName === "history") {
    const target = args ? await resolveTarget(args) : null;
    const where = { guildId: input.guildId, ...(target ? { targetId: target.userId } : {}) };
    const [count, recent] = await Promise.all([db.auditLog.count({ where }), db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 5, select: { action: true } })]);
    return `📋 ${count} evento(s) no histórico. Últimos: ${recent.map((entry) => entry.action).join(", ") || "nenhum"}.`;
  }
  return `O comando /${commandName} foi recebido pelo plugin ${plugin.manifest.name}, mas ainda não possui um executor configurado.`;
}
