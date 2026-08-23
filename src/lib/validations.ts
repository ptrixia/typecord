import { z } from "zod";

export const guildSchema = z.object({
  name: z.string().min(2, "O nome deve ter no mínimo 2 caracteres."),
  iconUrl: z.string().url().optional().or(z.literal("")),
});

export const channelSchema = z.object({
  name: z.string().min(1, "O nome do canal é obrigatório.").refine(
    name => name !== "geral", 
    { message: "O nome 'geral' é reservado." }
  ),
  type: z.enum(["GUILD_TEXT", "GUILD_VOICE", "GUILD_VIDEO"]),
});

export const messageSchema = z.object({
  content: z.string().min(1, "A mensagem não pode ser vazia."),
  channelId: z.string().uuid(),
});

export function getFileUrl(urlOrKey?: string | null) {
  if (!urlOrKey) return "";

  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://") ||
    urlOrKey.startsWith("blob:") ||
    urlOrKey.startsWith("/")
  ) {
    return urlOrKey;
  }

  return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
}