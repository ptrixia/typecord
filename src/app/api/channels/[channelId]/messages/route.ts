import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getBotIdsWithChannelAccess,
  getEffectiveChannelPermissions,
} from "@/lib/channel-permissions";
import { db } from "@/lib/db";
import { gatewayService } from "@/lib/gateway/GatewayService";
import { Permissions, hasPermission } from "@/lib/permissions";
import { emitToChannel } from "@/lib/realtime/emitter";
import { enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

const urlSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "http:" || url.protocol === "https:";
}, "URL inválida.");

const embedFieldSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().min(1).max(1024),
  inline: z.boolean().optional(),
});

const embedSchema = z.object({
  title: z.string().max(256).optional(),
  description: z.string().max(4096).optional(),
  url: urlSchema.optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timestamp: z.string().datetime().optional(),
  author: z
    .object({
      name: z.string().min(1).max(256),
      url: urlSchema.optional(),
      iconUrl: urlSchema.optional(),
    })
    .optional(),
  footer: z
    .object({
      text: z.string().min(1).max(2048),
      iconUrl: urlSchema.optional(),
    })
    .optional(),
  image: z.object({ url: urlSchema }).optional(),
  thumbnail: z.object({ url: urlSchema }).optional(),
  fields: z.array(embedFieldSchema).max(25).optional(),
});

const messageSchema = z
  .object({
    content: z.string().max(8000).optional().default(""),
    replyToId: z.string().min(1).max(128).nullable().optional(),
    embeds: z.array(embedSchema).max(10).optional().default([]),
  })
  .refine(
    (value) => value.content.trim().length > 0 || value.embeds.length > 0,
    "A mensagem precisa possuir conteúdo ou embed.",
  );

const updateMessageSchema = z
  .object({
    content: z.string().max(8000).optional().default(""),
    embeds: z.array(embedSchema).max(10).optional().default([]),
  })
  .refine(
    (value) => value.content.trim().length > 0 || value.embeds.length > 0,
    "A mensagem precisa possuir conteúdo ou embed.",
  );

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function authenticateBot(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bot ")) {
    return null;
  }

  const token = authorization.slice(4).trim();
  if (!token || token.length > 512) {
    return null;
  }

  return db.bot.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      disabled: true,
      verified: true,
      user: {
        select: {
          id: true,
          username: true,
          globalName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

async function resolveBotChannel(
  bot: { userId: string },
  channelId: string,
  required: readonly bigint[],
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      guildId: true,
      type: true,
    },
  });

  if (!channel) {
    return { error: json({ success: false, message: "Canal não encontrado." }, 404) };
  }

  const member = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: bot.userId,
        guildId: channel.guildId,
      },
    },
    select: { id: true },
  });

  if (!member) {
    return {
      error: json(
        { success: false, message: "O bot não é membro deste servidor." },
        403,
      ),
    };
  }

  const permissions = await getEffectiveChannelPermissions(
    channel.guildId,
    bot.userId,
    channel.id,
  );

  if (!required.every((permission) => hasPermission(permissions, permission))) {
    return {
      error: json(
        { success: false, message: "O bot não possui permissão neste canal." },
        403,
      ),
    };
  }

  return { channel, member, permissions };
}

function embedCreate(embed: z.infer<typeof embedSchema>) {
  return {
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: embed.url ?? null,
    color: embed.color ?? null,
    timestamp: embed.timestamp ?? null,
    authorName: embed.author?.name ?? null,
    authorUrl: embed.author?.url ?? null,
    authorIcon: embed.author?.iconUrl ?? null,
    footerText: embed.footer?.text ?? null,
    footerIcon: embed.footer?.iconUrl ?? null,
    imageUrl: embed.image?.url ?? null,
    thumbnailUrl: embed.thumbnail?.url ?? null,
    fields: embed.fields ?? undefined,
  };
}

function serializeEmbed(embed: any) {
  return {
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    url: embed.url ?? undefined,
    color: embed.color ?? "#5865F2",
    timestamp: embed.timestamp ?? undefined,
    siteName: embed.authorName ?? undefined,
    author: embed.authorName
      ? {
          name: embed.authorName,
          url: embed.authorUrl ?? undefined,
          iconUrl: embed.authorIcon ?? undefined,
        }
      : undefined,
    footer: embed.footerText
      ? {
          text: embed.footerText,
          iconUrl: embed.footerIcon ?? undefined,
        }
      : undefined,
    image: embed.imageUrl ?? undefined,
    thumbnail: embed.thumbnailUrl ?? undefined,
    fields: Array.isArray(embed.fields) ? embed.fields : undefined,
  };
}

function serializeMessage(message: any, bot: any) {
  return {
    id: message.id,
    content: message.content,
    guildId: message.channel.guildId,
    channelId: message.channelId,
    author: {
      id: bot.user.id,
      username: bot.user.username,
      globalName: bot.user.globalName,
      avatarUrl: bot.user.avatarUrl,
    },
    authorId: bot.user.id,
    isBot: true,
    isBotVerified: Boolean(bot.verified),
    isWebhook: false,
    attachments: [],
    embeds: message.embeds.map(serializeEmbed),
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    replyToId: message.replyToId,
    reply: message.replyTo
      ? {
          messageId: message.replyTo.id,
          author:
            message.replyTo.member.nickname ||
            message.replyTo.member.user.globalName ||
            message.replyTo.member.user.username,
          content: message.replyTo.deleted ? "Mensagem apagada" : message.replyTo.content,
          avatarUrl: message.replyTo.member.user.avatarUrl,
        }
      : null,
  };
}

async function dispatchMessageEvent(
  event: "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE",
  channelId: string,
  guildId: string,
  botId: string,
  payload: Record<string, unknown>,
) {
  await Promise.allSettled([
    emitToChannel(channelId, event, {
      guildId,
      channelId,
      ...payload,
    }),
    (async () => {
      const botIds = await getBotIdsWithChannelAccess(guildId, channelId, {
        excludeBotId: botId,
      });

      if (botIds.length) {
        await gatewayService.broadcast(botIds, event, {
          guildId,
          channelId,
          ...payload,
        });
      }
    })(),
  ]);
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const bot = await authenticateBot(request);

    if (!bot) {
      return json({ success: false, message: "Bot Token inválido." }, 401);
    }

    if (bot.disabled) {
      return json({ success: false, message: "Este bot está desativado." }, 403);
    }

    const limited = await enforceRateLimit(request, "bot-message-create", 60, 60, bot.id);
    if (limited) return limited;

    const { channelId } = await context.params;
    const access = await resolveBotChannel(bot, channelId, [
      Permissions.VIEW_CHANNEL,
      Permissions.SEND_MESSAGES,
    ]);

    if ("error" in access) {
      return access.error;
    }

    const parsed = messageSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Payload inválido.",
        },
        400,
      );
    }

    if (parsed.data.embeds.length && !hasPermission(access.permissions, Permissions.EMBED_LINKS)) {
      return json(
        { success: false, message: "O bot não possui permissão para enviar embeds." },
        403,
      );
    }

    const replyToId = parsed.data.replyToId ?? null;

    if (replyToId) {
      const reply = await db.message.findFirst({
        where: {
          id: replyToId,
          channelId,
          deleted: false,
        },
        select: { id: true },
      });

      if (!reply) {
        return json({ success: false, message: "Mensagem respondida inválida." }, 400);
      }
    }

    const message = await db.message.create({
      data: {
        content: parsed.data.content.trim(),
        channelId,
        memberId: access.member.id,
        replyToId,
        embeds: {
          create: parsed.data.embeds.map(embedCreate),
        },
      },
      select: {
        id: true,
        content: true,
        channelId: true,
        replyToId: true,
        createdAt: true,
        editedAt: true,
        channel: { select: { guildId: true } },
        embeds: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            deleted: true,
            member: {
              select: {
                nickname: true,
                user: {
                  select: {
                    username: true,
                    globalName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const serialized = serializeMessage(message, bot);
    await dispatchMessageEvent("MESSAGE_CREATE", channelId, access.channel.guildId, bot.id, {
      message: serialized,
    });

    return json({ success: true, message: serialized }, 201);
  } catch (error) {
    console.error("[BOT_MESSAGE_POST]", error);
    return json({ success: false, message: "Erro interno ao enviar mensagem." }, 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const bot = await authenticateBot(request);

    if (!bot) {
      return json({ success: false, message: "Bot Token inválido." }, 401);
    }

    if (bot.disabled) {
      return json({ success: false, message: "Este bot está desativado." }, 403);
    }

    const limited = await enforceRateLimit(request, "bot-message-update", 90, 60, bot.id);
    if (limited) return limited;

    const { channelId } = await context.params;
    const messageId = request.nextUrl.searchParams.get("messageId")?.trim() ?? "";

    if (!messageId) {
      return json({ success: false, message: "messageId é obrigatório." }, 400);
    }

    const access = await resolveBotChannel(bot, channelId, [
      Permissions.VIEW_CHANNEL,
      Permissions.SEND_MESSAGES,
    ]);

    if ("error" in access) {
      return access.error;
    }

    const existing = await db.message.findFirst({
      where: {
        id: messageId,
        channelId,
        memberId: access.member.id,
        deleted: false,
      },
      select: { id: true },
    });

    if (!existing) {
      return json(
        { success: false, message: "Mensagem não encontrada ou não pertence a este bot." },
        404,
      );
    }

    const parsed = updateMessageSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Payload inválido." },
        400,
      );
    }

    if (parsed.data.embeds.length && !hasPermission(access.permissions, Permissions.EMBED_LINKS)) {
      return json(
        { success: false, message: "O bot não possui permissão para enviar embeds." },
        403,
      );
    }

    const updated = await db.message.update({
      where: { id: messageId },
      data: {
        content: parsed.data.content.trim(),
        editedAt: new Date(),
        embeds: {
          deleteMany: {},
          create: parsed.data.embeds.map(embedCreate),
        },
      },
      select: {
        id: true,
        content: true,
        channelId: true,
        replyToId: true,
        createdAt: true,
        editedAt: true,
        channel: { select: { guildId: true } },
        embeds: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            deleted: true,
            member: {
              select: {
                nickname: true,
                user: {
                  select: {
                    username: true,
                    globalName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const serialized = serializeMessage(updated, bot);
    await dispatchMessageEvent("MESSAGE_UPDATE", channelId, access.channel.guildId, bot.id, {
      message: serialized,
    });

    return json({ success: true, message: serialized });
  } catch (error) {
    console.error("[BOT_MESSAGE_PATCH]", error);
    return json({ success: false, message: "Erro interno ao editar mensagem." }, 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const bot = await authenticateBot(request);

    if (!bot) {
      return json({ success: false, message: "Bot Token inválido." }, 401);
    }

    if (bot.disabled) {
      return json({ success: false, message: "Este bot está desativado." }, 403);
    }

    const limited = await enforceRateLimit(request, "bot-message-delete", 90, 60, bot.id);
    if (limited) return limited;

    const { channelId } = await context.params;
    const messageId = request.nextUrl.searchParams.get("messageId")?.trim() ?? "";

    if (!messageId) {
      return json({ success: false, message: "messageId é obrigatório." }, 400);
    }

    const access = await resolveBotChannel(bot, channelId, [Permissions.VIEW_CHANNEL]);

    if ("error" in access) {
      return access.error;
    }

    const existing = await db.message.findFirst({
      where: {
        id: messageId,
        channelId,
        memberId: access.member.id,
        deleted: false,
      },
      select: { id: true },
    });

    if (!existing) {
      return json(
        { success: false, message: "Mensagem não encontrada ou não pertence a este bot." },
        404,
      );
    }

    await db.message.update({
      where: { id: messageId },
      data: {
        deleted: true,
        content: "",
        editedAt: new Date(),
        embeds: { deleteMany: {} },
      },
    });

    await dispatchMessageEvent("MESSAGE_DELETE", channelId, access.channel.guildId, bot.id, {
      messageId,
      message: { id: messageId, deleted: true },
    });

    return json({ success: true, messageId });
  } catch (error) {
    console.error("[BOT_MESSAGE_DELETE]", error);
    return json({ success: false, message: "Erro interno ao excluir mensagem." }, 500);
  }
}
