import { z } from "zod";

const optionalHttpUrl = z
  .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
  .optional()
  .transform((value) => (typeof value === "string" && value ? value : null))
  .refine((value) => {
    if (!value) return true;
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  }, "A URL precisa usar HTTP ou HTTPS.");

export const guildSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter no mínimo 2 caracteres.")
    .max(100, "O nome pode ter no máximo 100 caracteres."),
  iconUrl: optionalHttpUrl,
});

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "O nome do canal é obrigatório.")
    .max(100, "O nome do canal pode ter no máximo 100 caracteres."),
  type: z.enum(["GUILD_TEXT", "GUILD_VOICE", "GUILD_VIDEO", "GUILD_ANNOUNCEMENT"]),
});

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "A mensagem não pode ser vazia.")
    .max(8000, "A mensagem pode ter no máximo 8.000 caracteres."),
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
