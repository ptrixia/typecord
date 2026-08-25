
import "dotenv/config";

import { io, type Socket } from "socket.io-client";

const TYPECORD_URL =
  process.env.TYPECORD_URL?.trim() ||
  "https://app.tysaiw.com";

const TYPECORD_GATEWAY_URL =
  process.env.TYPECORD_GATEWAY_URL?.trim() ||
  "https://gateway.tysaiw.com";

const TYPECORD_GATEWAY_PATH =
  process.env.TYPECORD_GATEWAY_PATH?.trim() ||
  "/socket.io";

const BOT_TOKEN =
  process.env.BOT_TOKEN ||
  "tc_bot_pbxJ6Ab3lbwEPt18LknTHgKU8XGnCdVGjscHy3PUhXjhqf4dL0cfKkpQPn6gpKX0";

const WELCOME_CHANNEL_ID =
  process.env.WELCOME_CHANNEL_ID || "12f20524-4bb8-43c3-9919-a88c721b4a15";

const REQUEST_TIMEOUT_MS = 15_000;
const SESSION_REFRESH_MARGIN_MS = 30_000;
const MAX_SEEN_EVENTS = 5_000;
const MAX_PROCESSED_MESSAGES = 5_000;

interface EmbedAuthor {
  name: string;
  url?: string;
  iconUrl?: string;
}

interface EmbedFooter {
  text: string;
  iconUrl?: string;
}

interface EmbedImage {
  url: string;
}

export interface BotEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  timestamp?: string;
  author?: EmbedAuthor;
  footer?: EmbedFooter;
  image?: EmbedImage;
  thumbnail?: EmbedImage;
}

interface GatewaySession {
  id: string;
  token: string;
  expiresAt: string;
}

interface GatewayResponse {
  url?: string;

  session: GatewaySession;

  bot: {
    id: string;

    user: {
      id: string;
      username: string;
      globalName: string | null;
      avatarUrl: string | null;
    };
  };

  guilds: {
    id: string;
    name: string;
    iconUrl: string | null;
  }[];
}

interface GatewayDispatch<T = unknown> {
  op: "DISPATCH";
  type: string;
  data: T;
  eventId?: string;
  emittedAt?: string;
}

interface GatewayReadyPayload {
  sessionId?: string;
  userId?: string;
  guildIds?: string[];
  connectedAt?: string;

  bot?: {
    id?: string;

    user?: {
      id: string;
      username: string;
      globalName?: string | null;
      avatarUrl?: string | null;
    };
  };

  guilds?: {
    id: string;
    name?: string;
    iconUrl?: string | null;
  }[];
}

interface MessageAttachment {
  id: string;
  url: string;
  filename: string;
  fileSize: number;
  fileType: string;
}

interface MessageCreateData {
  id: string;
  content: string;
  guildId: string;
  channelId: string;

  author: {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
  };

  isBot?: boolean;
  isBotVerified?: boolean;
  isWebhook?: boolean;

  attachments?: MessageAttachment[];
  embeds?: BotEmbed[];

  createdAt: string;
  replyToId?: string | null;
  reply?: unknown;
}

interface RawMessageData {
  content?: unknown;
  reply?: unknown;
  replyToId?: unknown;
  attachments?: unknown;
  embeds?: unknown;
}

interface NormalizedGuildMemberAdd {
  id: string;
  guildId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
}

interface GatewayServerToClientEvents {
  "gateway:ready": (payload: GatewayReadyPayload) => void;
  "gateway:event": (payload: GatewayDispatch) => void;
}

interface GatewayClientToServerEvents {
  "gateway:ping": (
    callback: (
      response:
        | {
            ok: true;
            data?: {
              serverTime: string;
            };
          }
        | {
            ok: false;
            code: string;
            message: string;
          },
    ) => void,
  ) => void;
}

type GatewaySocket = Socket<
  GatewayServerToClientEvents,
  GatewayClientToServerEvents
>;

let socket: GatewaySocket | null = null;
let currentSession: GatewaySession | null = null;
let currentBotUserId: string | null = null;
let sessionPromise: Promise<GatewayResponse> | null = null;
let shuttingDown = false;

const seenEvents = new Map<string, number>();
const processedMessages = new Map<string, number>();

function requireEnvironment() {
  if (!BOT_TOKEN) {
    throw new Error(
      "TYPECORD_BOT_TOKEN não foi configurado no ambiente.",
    );
  }
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  timer.unref?.();

  return {
    signal: controller.signal,

    clear() {
      clearTimeout(timer);
    },
  };
}

function isSessionUsable(session: GatewaySession | null) {
  if (!session?.token || !session.expiresAt) {
    return false;
  }

  const expiresAt = new Date(session.expiresAt).getTime();

  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  return (
    expiresAt - Date.now() >
    SESSION_REFRESH_MARGIN_MS
  );
}

async function requestGatewaySession(): Promise<GatewayResponse> {
  requireEnvironment();

  const timeout = createTimeoutSignal(
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${TYPECORD_URL}/api/gateway`,
      {
        method: "GET",

        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          Accept: "application/json",
        },

        cache: "no-store",
        signal: timeout.signal,
      },
    );

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Gateway recusou o bot (${response.status}): ${body.slice(
          0,
          1000,
        )}`,
      );
    }

    let data: GatewayResponse;

    try {
      data = JSON.parse(body) as GatewayResponse;
    } catch {
      throw new Error(
        `Resposta inválida de /api/gateway: ${body.slice(
          0,
          1000,
        )}`,
      );
    }

    if (
      !data.session?.id ||
      !data.session?.token ||
      !data.session?.expiresAt
    ) {
      throw new Error(
        "/api/gateway não retornou uma sessão válida.",
      );
    }

    if (
      !data.bot?.id ||
      !data.bot?.user?.id ||
      !data.bot?.user?.username
    ) {
      throw new Error(
        "/api/gateway não retornou dados válidos do bot.",
      );
    }

    currentSession = data.session;
    currentBotUserId = data.bot.user.id;

    console.log(
      `🤖 Autenticado como @${data.bot.user.username}`,
    );

    console.log(
      `🆔 User ID: ${data.bot.user.id}`,
    );

    console.log(
      `🏠 Guilds: ${data.guilds?.length ?? 0}`,
    );

    console.log(
      `🎫 Sessão: ${data.session.id}`,
    );

    return data;
  } finally {
    timeout.clear();
  }
}

async function getGatewaySession(
  forceRefresh = false,
): Promise<GatewayResponse> {
  if (
    !forceRefresh &&
    isSessionUsable(currentSession)
  ) {
    return {
      session: currentSession!,
      bot: {
        id: "",
        user: {
          id: currentBotUserId!,
          username: "cached",
          globalName: null,
          avatarUrl: null,
        },
      },
      guilds: [],
      url: TYPECORD_GATEWAY_URL,
    };
  }

  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = requestGatewaySession().finally(
    () => {
      sessionPromise = null;
    },
  );

  return sessionPromise;
}

function pruneMap(
  map: Map<string, number>,
  maximum: number,
) {
  if (map.size <= maximum) {
    return;
  }

  const removeCount =
    map.size - Math.floor(maximum * 0.8);

  let removed = 0;

  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;

    if (removed >= removeCount) {
      break;
    }
  }
}

function isDuplicateEvent(
  payload: GatewayDispatch,
) {
  if (!payload.eventId) {
    return false;
  }

  if (seenEvents.has(payload.eventId)) {
    return true;
  }

  seenEvents.set(
    payload.eventId,
    Date.now(),
  );

  pruneMap(
    seenEvents,
    MAX_SEEN_EVENTS,
  );

  return false;
}

function isDuplicateMessage(
  messageId: string,
) {
  if (!messageId) {
    return false;
  }

  if (
    processedMessages.has(messageId)
  ) {
    return true;
  }

  processedMessages.set(
    messageId,
    Date.now(),
  );

  pruneMap(
    processedMessages,
    MAX_PROCESSED_MESSAGES,
  );

  return false;
}

function normalizeMessage(
  message: MessageCreateData,
): MessageCreateData {
  if (
    typeof message?.content !== "string"
  ) {
    return message;
  }

  const rawContent =
    message.content.trim();

  if (
    !rawContent.startsWith("{") ||
    !rawContent.endsWith("}")
  ) {
    return message;
  }

  try {
    const parsed = JSON.parse(
      rawContent,
    ) as RawMessageData;

    if (
      !parsed ||
      typeof parsed !== "object"
    ) {
      return message;
    }

    const nestedContent =
      typeof parsed.content === "string"
        ? parsed.content
        : message.content;

    const nestedEmbeds =
      Array.isArray(parsed.embeds)
        ? (parsed.embeds as BotEmbed[])
        : message.embeds ?? [];

    const nestedAttachments =
      Array.isArray(parsed.attachments)
        ? (parsed.attachments as MessageAttachment[])
        : message.attachments ?? [];

    const nestedReplyToId =
      typeof parsed.replyToId === "string"
        ? parsed.replyToId
        : message.replyToId ?? null;

    return {
      ...message,

      content: nestedContent,
      embeds: nestedEmbeds,
      attachments: nestedAttachments,
      replyToId: nestedReplyToId,
      reply: parsed.reply ?? message.reply,
    };
  } catch {
    return message;
  }
}

function normalizeGuildMemberAdd(
  payload: unknown,
): NormalizedGuildMemberAdd | null {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const root = payload as Record<
    string,
    any
  >;

  const member =
    root.member &&
    typeof root.member === "object"
      ? root.member
      : root;

  const user =
    member.user &&
    typeof member.user === "object"
      ? member.user
      : root.user &&
          typeof root.user === "object"
        ? root.user
        : member;

  const id =
    typeof user.id === "string"
      ? user.id
      : "";

  const guildId =
    typeof root.guildId === "string"
      ? root.guildId
      : typeof member.guildId === "string"
        ? member.guildId
        : "";

  const username =
    typeof user.username === "string"
      ? user.username
      : "";

  if (!id || !guildId || !username) {
    return null;
  }

  return {
    id,
    guildId,
    username,

    globalName:
      typeof user.globalName === "string"
        ? user.globalName
        : null,

    avatarUrl:
      typeof user.avatarUrl === "string"
        ? user.avatarUrl
        : null,
  };
}

function resolveFileUrl(
  urlOrKey?: string | null,
) {
  if (!urlOrKey) {
    return undefined;
  }

  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://")
  ) {
    return urlOrKey;
  }

  return `${TYPECORD_URL}/api/files?key=${encodeURIComponent(
    urlOrKey,
  )}`;
}

async function sendMessage(
  channelId: string,
  content = "",
  replyToId?: string,
  embed?: BotEmbed,
) {
  requireEnvironment();

  if (!channelId) {
    throw new Error(
      "channelId não informado.",
    );
  }

  const payload: {
    content: string;
    replyToId?: string;
    embeds?: BotEmbed[];
  } = {
    content,
  };

  if (replyToId) {
    payload.replyToId = replyToId;
  }

  if (embed) {
    payload.embeds = [embed];
  }

  const timeout = createTimeoutSignal(
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      `${TYPECORD_URL}/api/channels/${encodeURIComponent(
        channelId,
      )}/messages`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bot ${BOT_TOKEN}`,

          Accept:
            "application/json",
        },

        body: JSON.stringify(payload),
        signal: timeout.signal,
      },
    );

    const body = await response.text();

    if (!response.ok) {
      throw new Error(
        `Falha ao enviar mensagem (${response.status}): ${body.slice(
          0,
          1000,
        )}`,
      );
    }

    if (!body) {
      return null;
    }

    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  } finally {
    timeout.clear();
  }
}

function logMessage(
  message: MessageCreateData,
) {
  const normalized =
    normalizeMessage(message);

  const date =
    new Date(
      normalized.createdAt,
    );

  console.log("");
  console.log(
    "╔══════════════════════════════════════╗",
  );
  console.log(
    "║ 💬 NOVA MENSAGEM",
  );
  console.log(
    "╠══════════════════════════════════════╣",
  );

  console.log(
    `║ 👤 Usuário: ${
      normalized.author.globalName ??
      normalized.author.username
    }`,
  );

  console.log(
    `║ 🏷️ Username: @${normalized.author.username}`,
  );

  console.log(
    `║ 🆔 User ID: ${normalized.author.id}`,
  );

  console.log(
    `║ 🤖 Bot: ${
      normalized.isBot
        ? "sim"
        : "não"
    }`,
  );

  console.log(
    `║ 🏠 Guild ID: ${normalized.guildId}`,
  );

  console.log(
    `║ 💬 Channel ID: ${normalized.channelId}`,
  );

  console.log(
    `║ 🕐 Data: ${
      Number.isNaN(date.getTime())
        ? normalized.createdAt
        : date.toLocaleString(
            "pt-BR",
          )
    }`,
  );

  console.log(
    `║ 📝 Mensagem: ${normalized.content}`,
  );

  console.log(
    `║ 🖼️ Embeds: ${
      normalized.embeds?.length ??
      0
    }`,
  );

  console.log(
    `║ 📎 Anexos: ${
      normalized.attachments
        ?.length ?? 0
    }`,
  );

  console.log(
    "╚══════════════════════════════════════╝",
  );

  console.log("");
}

async function handleMessage(
  originalMessage: MessageCreateData,
) {
  if (
    !originalMessage ||
    !originalMessage.id ||
    !originalMessage.channelId ||
    !originalMessage.author?.id
  ) {
    console.warn(
      "⚠️ MESSAGE_CREATE inválido:",
      originalMessage,
    );

    return;
  }

  if (
    isDuplicateMessage(
      originalMessage.id,
    )
  ) {
    return;
  }

  const message =
    normalizeMessage(
      originalMessage,
    );

  if (
    message.author.id ===
    currentBotUserId
  ) {
    return;
  }

  logMessage(message);

  const rawContent =
    message.content.trim();

  if (
    !rawContent.startsWith("!")
  ) {
    return;
  }

  const args =
    rawContent.split(/\s+/);

  const command =
    args.shift()?.toLowerCase();

  if (command === "!ping") {
    const createdAt =
      new Date(
        message.createdAt,
      ).getTime();

    const ping =
      Number.isFinite(createdAt)
        ? Math.max(
            0,
            Date.now() -
              createdAt,
          )
        : 0;

    await sendMessage(
      message.channelId,
      `Pong! 🏓 **${ping}ms**`,
      message.id,
    );

    return;
  }

  if (command === "!help") {
    await sendMessage(
      message.channelId,
      "",
      message.id,
      {
        title:
          "📚 Lista de Comandos",

        color: "#5865F2",

        description:
          "**!ping** - Verifica a latência do bot.\n" +
          "**!hello** - O bot diz olá para você.\n" +
          "**!say <texto>** - Faz o bot repetir o que você escreveu.\n" +
          "**!userinfo** - Mostra suas informações.\n" +
          "**!avatar** - Mostra o seu avatar.\n" +
          "**!coinflip** - Joga uma moeda.\n" +
          "**!roll [lados]** - Rola um dado.\n" +
          "**!embed** - Envia um embed de teste.",
      },
    );

    return;
  }

  if (command === "!say") {
    const text =
      args.join(" ").trim();

    if (!text) {
      await sendMessage(
        message.channelId,
        "Você precisa me dizer o que repetir! Use: `!say <texto>`",
        message.id,
      );

      return;
    }

    await sendMessage(
      message.channelId,
      text,
    );

    return;
  }

  if (command === "!userinfo") {
    const avatarMarkdown =
      message.author.avatarUrl
        ? `\n\n![Avatar](${resolveFileUrl(
            message.author.avatarUrl,
          )})`
        : "";

    await sendMessage(
      message.channelId,
      "",
      message.id,
      {
        title:
          "👤 Informações do Usuário",

        color: "#00FF00",

        description:
          `**Nome Global:** ${
            message.author.globalName ||
            "Nenhum"
          }\n` +
          `**Username:** @${message.author.username}\n` +
          `**ID:** ${message.author.id}` +
          avatarMarkdown,
      },
    );

    return;
  }

  if (command === "!avatar") {
    const avatarUrl =
      resolveFileUrl(
        message.author.avatarUrl,
      );

    if (!avatarUrl) {
      await sendMessage(
        message.channelId,
        "Você não possui um avatar!",
        message.id,
      );

      return;
    }

    await sendMessage(
      message.channelId,
      "",
      message.id,
      {
        title:
          `Avatar de @${message.author.username}`,

        color: "#FF00FF",

        image: {
          url: avatarUrl,
        },
      },
    );

    return;
  }

  if (
    command === "!coinflip"
  ) {
    const result =
      Math.random() < 0.5
        ? "Cara 🪙"
        : "Coroa 🪙";

    await sendMessage(
      message.channelId,
      `A moeda caiu em: **${result}**`,
      message.id,
    );

    return;
  }

  if (command === "!roll") {
    const parsedSides =
      args.length > 0
        ? Number.parseInt(
            args[0],
            10,
          )
        : 6;

    const sides =
      Number.isSafeInteger(
        parsedSides,
      ) &&
      parsedSides >= 2 &&
      parsedSides <= 1_000_000
        ? parsedSides
        : 6;

    const result =
      Math.floor(
        Math.random() * sides,
      ) + 1;

    await sendMessage(
      message.channelId,
      `🎲 Você rolou um dado de ${sides} lados e tirou: **${result}**`,
      message.id,
    );

    return;
  }

  if (command === "!hello") {
    const name =
      message.author.globalName ??
      message.author.username;

    await sendMessage(
      message.channelId,
      `Olá, ${name}! 👋`,
      message.id,
    );

    return;
  }

  if (command === "!embed") {
    await sendMessage(
      message.channelId,
      "",
      message.id,
      {
        title:
          "Embed de teste",

        description:
          "Este é um embed enviado pelo Typecord Bot através do novo Gateway Socket.IO.",

        color: "#5865F2",

        footer: {
          text:
            "Typecord • Bot",
        },

        timestamp:
          new Date().toISOString(),
      },
    );

    return;
  }
}

async function handleGuildMemberAdd(
  rawPayload: unknown,
) {
  const payload =
    normalizeGuildMemberAdd(
      rawPayload,
    );

  if (!payload) {
    console.error(
      "❌ Payload de GUILD_MEMBER_ADD inválido:",
      rawPayload,
    );

    return;
  }

  const {
    id,
    guildId,
    username,
    globalName,
    avatarUrl,
  } = payload;

  const displayName =
    globalName ?? username;

  console.log("");
  console.log(
    "👤 Novo membro recebido",
  );

  console.log(
    `🏠 Guild ID: ${guildId}`,
  );

  console.log(
    `🆔 User ID: ${id}`,
  );

  console.log(
    `👤 Username: @${username}`,
  );

  if (!WELCOME_CHANNEL_ID) {
    console.warn(
      "⚠️ WELCOME_CHANNEL_ID não configurado.",
    );

    return;
  }

  const resolvedAvatarUrl =
    resolveFileUrl(avatarUrl);

  const embed: BotEmbed = {
    title: "🎉 Novo membro!",

    description:
      `Seja muito bem-vindo(a), **${displayName}**! 👋\n\n` +
      "Esperamos que você aproveite o servidor e se divirta por aqui!",

    color: "#5865F2",

    author: {
      name: `@${username}`,
      iconUrl:
        resolvedAvatarUrl,
    },

    thumbnail:
      resolvedAvatarUrl
        ? {
            url:
              resolvedAvatarUrl,
          }
        : undefined,

    footer: {
      text:
        "Typecord • Bem-vindo!",
    },

    timestamp:
      new Date().toISOString(),
  };

  try {
    await sendMessage(
      WELCOME_CHANNEL_ID,
      "",
      undefined,
      embed,
    );

    console.log(
      `✅ Mensagem de boas-vindas enviada para ${displayName}.`,
    );
  } catch (error) {
    console.error(
      `❌ Erro ao enviar mensagem de boas-vindas para ${displayName}:`,
      error,
    );
  }
}

function handleReady(
  payload: GatewayReadyPayload,
) {
  if (payload.userId) {
    currentBotUserId =
      payload.userId;
  }

  if (
    payload.bot?.user?.id
  ) {
    currentBotUserId =
      payload.bot.user.id;
  }

  const guildCount =
    payload.guildIds?.length ??
    payload.guilds?.length ??
    0;

  console.log("");
  console.log(
    "🤖 ========================================",
  );

  console.log(
    "🤖 TYPECORD BOT ONLINE",
  );

  console.log(
    "🤖 ========================================",
  );

  console.log(
    `🆔 User ID: ${
      currentBotUserId ??
      "desconhecido"
    }`,
  );

  console.log(
    `🏠 Guilds: ${guildCount}`,
  );

  if (payload.sessionId) {
    console.log(
      `🔌 Socket Session: ${payload.sessionId}`,
    );
  }

  console.log("");
  console.log(
    "💡 Comandos carregados. Use !help no chat.",
  );

  console.log(
    "👋 Sistema de boas-vindas carregado.",
  );

  console.log("");
}

async function handleDispatch(
  payload: GatewayDispatch,
) {
  if (
    !payload ||
    payload.op !== "DISPATCH" ||
    typeof payload.type !== "string"
  ) {
    console.warn(
      "⚠️ Dispatch inválido:",
      payload,
    );

    return;
  }

  if (isDuplicateEvent(payload)) {
    return;
  }

  switch (payload.type) {
    case "READY": {
      handleReady(
        payload.data as GatewayReadyPayload,
      );

      return;
    }

    case "MESSAGE_CREATE": {
      try {
        await handleMessage(
          payload.data as MessageCreateData,
        );
      } catch (error) {
        console.error(
          "❌ Erro processando MESSAGE_CREATE:",
          error,
        );
      }

      return;
    }

    case "GUILD_MEMBER_ADD": {
      try {
        await handleGuildMemberAdd(
          payload.data,
        );
      } catch (error) {
        console.error(
          "❌ Erro processando GUILD_MEMBER_ADD:",
          error,
        );
      }

      return;
    }

    case "MESSAGE_UPDATE":
    case "MESSAGE_DELETE":
    case "GUILD_UPDATE":
    case "GUILD_MEMBER_UPDATE":
    case "GUILD_MEMBER_REMOVE":
    case "CHANNEL_CREATE":
    case "CHANNEL_UPDATE":
    case "CHANNEL_DELETE":
    case "VOICE_STATE_UPDATE":
    case "PRESENCE_UPDATE": {
      console.log(
        `📨 Evento recebido: ${payload.type}`,
      );

      return;
    }

    default: {
      console.log(
        `📦 Evento desconhecido recebido: ${payload.type}`,
      );
    }
  }
}

async function createSocket() {
  requireEnvironment();

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  await getGatewaySession(true);

  const client = io(
    TYPECORD_GATEWAY_URL,
    {
      path:
        TYPECORD_GATEWAY_PATH,

      transports: [
        "websocket",
      ],

      autoConnect: false,

      reconnection: true,

      reconnectionAttempts:
        Infinity,

      reconnectionDelay:
        1_000,

      reconnectionDelayMax:
        15_000,

      randomizationFactor:
        0.5,

      timeout: 15_000,

      forceNew: true,

      auth: async (
        callback,
      ) => {
        try {
          const gateway =
            await getGatewaySession();

          callback({
            token:
              gateway.session.token,

            sessionId:
              gateway.session.id,

            kind: "bot",
          });
        } catch (error) {
          console.error(
            "❌ Não foi possível obter sessão do Gateway:",
            error,
          );

          callback({
            token: "",
            kind: "bot",
          });
        }
      },
    },
  ) as GatewaySocket;

  socket = client;

  client.on(
    "connect",
    () => {
      console.log(
        `🟢 Gateway conectado: ${TYPECORD_GATEWAY_URL}`,
      );

      console.log(
        `🔌 Socket ID: ${client.id}`,
      );
    },
  );

  client.on(
    "gateway:ready",
    (payload) => {
      handleReady(payload);
    },
  );

  client.on(
    "gateway:event",
    (payload) => {
      void handleDispatch(
        payload,
      );
    },
  );

  client.on(
    "disconnect",
    (reason) => {
      console.log(
        `🔴 Gateway desconectado: ${reason}`,
      );

      if (shuttingDown) {
        return;
      }

      if (
        reason ===
        "io server disconnect"
      ) {
        currentSession = null;

        setTimeout(() => {
          if (
            !shuttingDown &&
            socket === client
          ) {
            client.connect();
          }
        }, 1_000).unref?.();
      }
    },
  );

  client.on(
    "connect_error",
    (error) => {
      const gatewayError = error as Error & {
        data?: {
          code?: unknown;
        };
      };

      const code =
        typeof gatewayError.data?.code === "string"
          ? gatewayError.data.code
          : "UNKNOWN";

      console.error(
        `❌ Erro de conexão com o Gateway [${code}]: ${error.message}`,
      );

      if (
        code ===
          "AUTH_INVALID" ||
        code ===
          "AUTH_EXPIRED" ||
        code ===
          "SESSION_EXPIRED" ||
        /token|session|auth/i.test(
          error.message,
        )
      ) {
        currentSession = null;
      }
    },
  );

  client.io.on(
    "reconnect_attempt",
    (attempt) => {
      console.log(
        `🟡 Tentativa de reconexão #${attempt}...`,
      );
    },
  );

  client.io.on(
    "reconnect",
    (attempt) => {
      console.log(
        `🟢 Reconectado após ${attempt} tentativa(s).`,
      );
    },
  );

  client.io.on(
    "reconnect_error",
    (error) => {
      console.error(
        "❌ Erro durante reconexão:",
        error.message,
      );
    },
  );

  return client;
}

async function start() {
  console.log("");
  console.log(
    "================================",
  );

  console.log(
    "       TYPECORD BOT",
  );

  console.log(
    "================================",
  );

  console.log("");
  console.log(
    `🌐 API: ${TYPECORD_URL}`,
  );

  console.log(
    `⚡ Gateway: ${TYPECORD_GATEWAY_URL}`,
  );

  console.log("");

  try {
    const client =
      await createSocket();

    console.log(
      "👂 Conectando e aguardando eventos...",
    );

    client.connect();
  } catch (error) {
    console.error(
      "❌ Não foi possível iniciar o bot:",
      error,
    );

    process.exitCode = 1;
  }
}

async function shutdown(
  signal: string,
) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(
    `🛑 Desligando bot (${signal})...`,
  );

  try {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
  } finally {
    currentSession = null;
  }

  process.exit(0);
}

process.on(
  "SIGINT",
  () => {
    void shutdown("SIGINT");
  },
);

process.on(
  "SIGTERM",
  () => {
    void shutdown("SIGTERM");
  },
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Promise rejeitada sem tratamento:",
      error,
    );
  },
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Exceção não tratada:",
      error,
    );

    void shutdown(
      "uncaughtException",
    );
  },
);

await start();