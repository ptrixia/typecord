import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";
import { getPlugin, listInstalledPlugins } from "@/lib/plugins";
import { z } from "zod";
import { invalidateGuildCache } from "@/lib/cache";

const bodySchema = z.object({
  pluginId: z.string().min(2).max(64),
  enabled: z.boolean().optional(),
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const member = await db.member.findUnique({ where: { userId_guildId: { userId: user.id, guildId } }, select: { id: true } });
    if (!member) return apiError("Você não faz parte deste servidor.", 403, "GUILD_MEMBERSHIP_REQUIRED");
    return apiOk({ plugins: await listInstalledPlugins(guildId) });
  } catch (error) {
    return apiUnexpectedError(error, "guild-plugins-list");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    const user = await requirePermission(guildId, Permissions.MANAGE_GUILD);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Dados do plugin inválidos.");
    const manifest = getPlugin(parsed.data.pluginId);
    if (!manifest) return apiError("Plugin não encontrado no catálogo.", 404, "PLUGIN_NOT_FOUND");
    const installation = await db.guildPluginInstallation.upsert({
      where: { guildId_pluginId: { guildId, pluginId: manifest.id } },
      create: { guildId, pluginId: manifest.id, version: manifest.version, installedById: user.id, settings: parsed.data.settings ?? undefined },
      update: { version: manifest.version, enabled: true, settings: parsed.data.settings ?? undefined, installedById: user.id },
    });
    await invalidateGuildCache(guildId);
    return apiOk({ installation }, 201);
  } catch (error) {
    return apiUnexpectedError(error, "guild-plugin-install");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await requirePermission(guildId, Permissions.MANAGE_GUILD);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.enabled === undefined) return apiError("Informe enabled para ativar ou desativar o plugin.");
    const existing = await db.guildPluginInstallation.findUnique({ where: { guildId_pluginId: { guildId, pluginId: parsed.data.pluginId } } });
    if (!existing) return apiError("Plugin não instalado neste servidor.", 404, "PLUGIN_NOT_INSTALLED");
    const installation = await db.guildPluginInstallation.update({ where: { id: existing.id }, data: { enabled: parsed.data.enabled } });
    await invalidateGuildCache(guildId);
    return apiOk({ installation });
  } catch (error) {
    return apiUnexpectedError(error, "guild-plugin-toggle");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ guildId: string }> }) {
  try {
    const { guildId } = await params;
    await requirePermission(guildId, Permissions.MANAGE_GUILD);
    const parsed = bodySchema.pick({ pluginId: true }).safeParse(await request.json());
    if (!parsed.success) return apiError("pluginId é obrigatório.");
    await db.guildPluginInstallation.deleteMany({ where: { guildId, pluginId: parsed.data.pluginId } });
    await invalidateGuildCache(guildId);
    return apiOk({ removed: true });
  } catch (error) {
    return apiUnexpectedError(error, "guild-plugin-uninstall");
  }
}
