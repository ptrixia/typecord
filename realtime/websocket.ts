import "dotenv/config";

import { createServer } from "http";
import { createHash, randomUUID } from "crypto";

import { Server, type Socket as IOSocket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { jwtVerify } from "jose";

import { db } from "@/lib/db";

import { canUserAccessChannel } from "@/lib/channel-permissions";

import {
  GATEWAY_PATH,
  SOCKET_IO_REDIS_KEY,
  type ClientToServerEvents,
  type GatewayAck,
  type GatewayDispatch,
  type InterServerEvents,
  type RealtimeEventName,
  type ServerToClientEvents,
} from "@/lib/realtime/contracts";

import {
  channelRoom,
  guildRoom,
  userRoom,
} from "@/lib/realtime/rooms";


const HOST =
  process.env.GATEWAY_HOST ||
  "0.0.0.0";

const PORT = Number(
  process.env.GATEWAY_PORT || 3001,
);

const PRESENCE_TTL_SECONDS = 120;
const PRESENCE_STALE_MS = 90_000;
const PRESENCE_HEARTBEAT_MS = 30_000;

const INSTANCE_ID = randomUUID();

const allowedOrigins = new Set(
  (
    process.env.GATEWAY_ALLOWED_ORIGINS ||
    "http://localhost:3000,https://app.tysaiw.com"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

type GatewayUser = {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  status: string;
};

type SocketKind = "user" | "bot";

type SocketData = {
  kind: SocketKind;
  user: GatewayUser;
  guildIds: string[];
  botId?: string;
  gatewaySessionId?: string;
};

type TypecordSocket = IOSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type SocketAuthError = Error & {
  data?: {
    code: string;
  };
};

class GatewayAuthenticationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GatewayAuthenticationError";
    this.code = code;
  }
}

function getRealtimeSecret() {
  const secret =
    process.env.REALTIME_JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "REALTIME_JWT_SECRET precisa ter pelo menos 32 caracteres.",
    );
  }

  return new TextEncoder().encode(secret);
}

const realtimeSecret = getRealtimeSecret();

function validIdentifier(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    value.length <= 128
  );
}

function isOriginAllowed(
  origin: string | undefined,
) {
  if (!origin) {
    return true;
  }

  return allowedOrigins.has(origin);
}

function botRoom(botId: string) {
  return `tc:bot:${botId}`;
}

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function toSocketAuthError(
  code: string,
  message: string,
): SocketAuthError {
  const error = new Error(message) as SocketAuthError;
  error.name = code;
  error.data = { code };
  return error;
}

function createDispatch<T>(
  type: RealtimeEventName,
  data: T,
): GatewayDispatch<T> {
  return {
    op: "DISPATCH",
    type,
    data,
    eventId: randomUUID(),
    emittedAt: new Date().toISOString(),
  };
}

const redisUrl =
  process.env.REDIS_URL ||
  "redis://localhost:6379";

const pubClient = createClient({
  url: redisUrl,

  socket: {
    reconnectStrategy(retries) {
      return Math.min(
        100 + retries * 200,
        5000,
      );
    },
  },
});

const subClient = pubClient.duplicate();
const stateRedis = pubClient.duplicate();

for (const client of [
  pubClient,
  subClient,
  stateRedis,
]) {
  client.on("error", (error) => {
    console.error(
      "[GATEWAY_REDIS_ERROR]",
      error,
    );
  });
}

Promise.all([
  pubClient.connect(),
  subClient.connect(),
  stateRedis.connect(),
]).catch((error) => {
  console.error("[REDIS_CONNECT_ERROR] Falha ao iniciar conexão:", error);
});

const httpServer = createServer();

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  path: GATEWAY_PATH,

  transports: ["websocket"],

  serveClient: false,

  maxHttpBufferSize: 64 * 1024,

  perMessageDeflate: false,

  pingInterval: 25_000,
  pingTimeout: 20_000,

  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          "Origin não permitida.",
        ),
      );
    },

    credentials: true,
  },

  allowRequest(request, callback) {
    const origin =
      request.headers.origin;

    callback(
      null,
      isOriginAllowed(origin),
    );
  },
});

io.adapter(
  createAdapter(
    pubClient,
    subClient,
    {
      key: SOCKET_IO_REDIS_KEY,

      publishOnSpecificResponseChannel:
        true,
    },
  ),
);

function presenceKey(userId: string) {
  return `typecord:presence:${userId}`;
}

const PRESENCE_USERS_KEY =
  "typecord:presence:users";

async function cleanPresence(
  userId: string,
) {
  const cutoff =
    Date.now() - PRESENCE_STALE_MS;

  await stateRedis.zRemRangeByScore(
    presenceKey(userId),
    0,
    cutoff,
  );

  return stateRedis.zCard(
    presenceKey(userId),
  );
}

async function touchPresence(
  userId: string,
  socketId: string,
) {
  const now = Date.now();

  await Promise.all([
    stateRedis.zAdd(
      presenceKey(userId),
      [
        {
          score: now,
          value: socketId,
        },
      ],
    ),

    stateRedis.zAdd(
      PRESENCE_USERS_KEY,
      [
        {
          score: now,
          value: userId,
        },
      ],
    ),
  ]);

  await stateRedis.expire(
    presenceKey(userId),
    PRESENCE_TTL_SECONDS,
  );
}

async function removePresence(
  userId: string,
  socketId: string,
) {
  await stateRedis.zRem(
    presenceKey(userId),
    socketId,
  );

  const count =
    await cleanPresence(userId);

  if (count === 0) {
    await stateRedis.zRem(
      PRESENCE_USERS_KEY,
      userId,
    );
  }

  return count;
}

async function loadGuildIds(
  userId: string,
) {
  const memberships =
    await db.member.findMany({
      where: {
        userId,
      },

      select: {
        guildId: true,
      },
    });

  return memberships.map(
    (membership) =>
      membership.guildId,
  );
}

async function broadcastToGuilds<T>(
  guildIds: string[],
  type: RealtimeEventName,
  data: T,
) {
  const rooms = [
    ...new Set(guildIds),
  ].map(guildRoom);

  if (rooms.length === 0) {
    return;
  }

  const dispatch =
    createDispatch(type, data);

  io.to(rooms).emit(
    "gateway:event",
    dispatch,
  );
}

async function broadcastPresence(
  userId: string,
  guildIds: string[],
  status: string,
  online: boolean,
) {
  await broadcastToGuilds(
    guildIds,
    "PRESENCE_UPDATE",
    {
      userId,
      status,
      online,
      updatedAt:
        new Date().toISOString(),
    },
  );
}

async function consumeRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number,
) {
  const bucket = Math.floor(
    Date.now() /
      (windowSeconds * 1000),
  );

  const key =
    `typecord:gateway:ratelimit:` +
    `${identifier}:${bucket}`;

  const result = await stateRedis
    .multi()
    .incr(key)
    .expire(
      key,
      windowSeconds + 1,
    )
    .exec();

  const count =
    Number(result[0]) || 0;

  return count <= limit;
}

async function resolveChannelAccess(
  userId: string,
  channelId: string,
) {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true },
  });

  if (!channel) {
    return null;
  }

  if (!(await canUserAccessChannel(userId, channelId))) {
    return null;
  }

  return {
    channelId: channel.id,
    guildId: channel.guildId,
  };
}

async function authenticateUser(
  token: string,
  socket: TypecordSocket,
) {
  const verification = await jwtVerify(
    token,
    realtimeSecret,
    {
      issuer: "typecord-web",
      audience: "typecord-gateway",
      algorithms: ["HS256"],
    },
  );

  const userId = verification.payload.sub;

  if (!userId) {
    throw new GatewayAuthenticationError(
      "AUTH_INVALID",
      "Token realtime inválido.",
    );
  }

  const allowed = await consumeRateLimit(
    `connection:user:${userId}`,
    30,
    60,
  );

  if (!allowed) {
    throw new GatewayAuthenticationError(
      "RATE_LIMITED",
      "Muitas conexões.",
    );
  }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      username: true,
      globalName: true,
      avatarUrl: true,
      status: true,
    },
  });

  if (!user) {
    throw new GatewayAuthenticationError(
      "AUTH_INVALID",
      "Usuário não encontrado.",
    );
  }

  const guildIds = await loadGuildIds(user.id);

  socket.data.kind = "user";
  socket.data.user = {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    avatarUrl: user.avatarUrl,
    status: String(user.status),
  };
  socket.data.guildIds = guildIds;
}

async function authenticateBot(
  token: string,
  sessionId: string,
  socket: TypecordSocket,
) {
  const session = await db.gatewaySession.findUnique({
    where: {
      id: sessionId,
    },
    include: {
      bot: {
        include: {
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
      },
    },
  });

  if (!session) {
    throw new GatewayAuthenticationError(
      "BOT_SESSION_INVALID",
      "Sessão do bot não encontrada.",
    );
  }

  if (session.revokedAt) {
    throw new GatewayAuthenticationError(
      "BOT_SESSION_REVOKED",
      "Sessão do bot revogada.",
    );
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    throw new GatewayAuthenticationError(
      "BOT_SESSION_EXPIRED",
      "Sessão do bot expirada.",
    );
  }

  if (session.bot.disabled) {
    throw new GatewayAuthenticationError(
      "BOT_DISABLED",
      "Este bot está desativado.",
    );
  }

  if (session.sessionTokenHash !== hashToken(token)) {
    throw new GatewayAuthenticationError(
      "BOT_SESSION_INVALID",
      "Token da sessão do bot inválido.",
    );
  }

  const allowed = await consumeRateLimit(
    `connection:bot:${session.botId}`,
    30,
    60,
  );

  if (!allowed) {
    throw new GatewayAuthenticationError(
      "RATE_LIMITED",
      "Muitas conexões.",
    );
  }

  const user = session.bot.user;
  const guildIds = await loadGuildIds(user.id);

  socket.data.kind = "bot";
  socket.data.botId = session.botId;
  socket.data.gatewaySessionId = session.id;
  socket.data.user = {
    id: user.id,
    username: user.username,
    globalName: user.globalName,
    avatarUrl: user.avatarUrl,
    status: String(user.status),
  };
  socket.data.guildIds = guildIds;

  await db.gatewaySession.update({
    where: {
      id: session.id,
    },
    data: {
      lastHeartbeatAt: new Date(),
    },
  });
}

io.use(async (socket, next) => {
  const auth = socket.handshake.auth ?? {};
  const token =
    typeof auth.token === "string"
      ? auth.token.trim()
      : "";

  const kind =
    auth.kind === "bot"
      ? "bot"
      : "user";

  try {
    if (!token) {
      throw new GatewayAuthenticationError(
        "AUTH_REQUIRED",
        "Token de autenticação ausente.",
      );
    }

    if (kind === "bot") {
      const sessionId =
        typeof auth.sessionId === "string"
          ? auth.sessionId.trim()
          : "";

      if (!sessionId) {
        throw new GatewayAuthenticationError(
          "BOT_SESSION_REQUIRED",
          "sessionId do bot não informado.",
        );
      }

      await authenticateBot(
        token,
        sessionId,
        socket,
      );
    } else {
      await authenticateUser(
        token,
        socket,
      );
    }

    console.log(
      `[GATEWAY_AUTH] kind=${socket.data.kind} user=${socket.data.user.id}` +
        (socket.data.botId
          ? ` bot=${socket.data.botId}`
          : ""),
    );

    next();
  } catch (error) {
    const code =
      error instanceof GatewayAuthenticationError
        ? error.code
        : "AUTH_INVALID";

    const message =
      error instanceof GatewayAuthenticationError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Autenticação inválida.";

    console.error(
      `[GATEWAY_AUTH_ERROR] kind=${kind} code=${code}:`,
      message,
    );

    next(
      toSocketAuthError(
        code,
        message,
      ),
    );
  }
});

io.on("connection", async (socket) => {
  const user =
    socket.data.user;

  const guildIds =
    socket.data.guildIds;

  const kind = socket.data.kind;

  console.log(
    `[GATEWAY] ${kind} ${user.id} conectado ${socket.id}`,
  );

  await stateRedis.incr("typecord:metrics:websocket:active");
  await stateRedis.expire("typecord:metrics:websocket:active", 180);

  const rooms = [
    userRoom(user.id),
    ...guildIds.map(
      guildRoom,
    ),
  ];

  if (
    kind === "bot" &&
    socket.data.botId
  ) {
    rooms.push(
      botRoom(socket.data.botId),
    );
  }

  await socket.join(rooms);

  if (kind === "user") {
    let previousConnections = 0;

    try {
      previousConnections =
        await cleanPresence(
          user.id,
        );

      await touchPresence(
        user.id,
        socket.id,
      );

      if (
        previousConnections === 0
      ) {
        const status =
          user.status === "OFFLINE"
            ? "ONLINE"
            : user.status;

        await broadcastPresence(
          user.id,
          guildIds,
          status,
          true,
        );
      }
    } catch (error) {
      console.error(
        "[PRESENCE_CONNECT_ERROR]",
        error,
      );
    }
  }

  socket.emit(
    "gateway:ready",
    {
      sessionId: socket.id,
      userId: user.id,
      guildIds,
      connectedAt:
        new Date().toISOString(),
    },
  );

  const heartbeat =
    setInterval(() => {
      if (
        kind === "bot" &&
        socket.data.gatewaySessionId
      ) {
        void db.gatewaySession
          .update({
            where: {
              id: socket.data.gatewaySessionId,
            },
            data: {
              lastHeartbeatAt: new Date(),
            },
          })
          .catch((error) => {
            console.error(
              "[BOT_HEARTBEAT_ERROR]",
              error,
            );
          });

        return;
      }

      void touchPresence(
        user.id,
        socket.id,
      ).catch((error) => {
        console.error(
          "[PRESENCE_HEARTBEAT_ERROR]",
          error,
        );
      });
    }, PRESENCE_HEARTBEAT_MS);

  socket.on("disconnect", () => {
    clearInterval(heartbeat);
    void stateRedis.decr("typecord:metrics:websocket:active").catch((error) => {
      console.error("[GATEWAY_METRICS_DISCONNECT]", error);
    });
  });

  socket.on(
    "gateway:subscribe-channel",
    async (
      payload,
      callback,
    ) => {
      try {
        if (
          !validIdentifier(
            payload?.channelId,
          )
        ) {
          callback({
            ok: false,
            code:
              "INVALID_CHANNEL",
            message:
              "Canal inválido.",
          });

          return;
        }

        const allowed =
          await consumeRateLimit(
            `subscribe:${user.id}`,
            120,
            60,
          );

        if (!allowed) {
          callback({
            ok: false,
            code: "RATE_LIMITED",
            message:
              "Muitas solicitações.",
          });

          return;
        }

        const access =
          await resolveChannelAccess(
            user.id,
            payload.channelId,
          );

        if (!access) {
          callback({
            ok: false,
            code:
              "ACCESS_DENIED",
            message:
              "Você não possui acesso a este canal.",
          });

          return;
        }

        await socket.join(
          channelRoom(
            access.channelId,
          ),
        );

        callback({
          ok: true,
          data: {
            channelId:
              access.channelId,
          },
        });
      } catch (error) {
        console.error(
          "[SUBSCRIBE_CHANNEL_ERROR]",
          error,
        );

        callback({
          ok: false,
          code:
            "INTERNAL_ERROR",
          message:
            "Não foi possível assinar o canal.",
        });
      }
    },
  );

  socket.on(
    "gateway:unsubscribe-channel",
    async (
      payload,
      callback,
    ) => {
      if (
        !validIdentifier(
          payload?.channelId,
        )
      ) {
        callback({
          ok: false,
          code:
            "INVALID_CHANNEL",
          message:
            "Canal inválido.",
        });

        return;
      }

      await socket.leave(
        channelRoom(
          payload.channelId,
        ),
      );

      callback({
        ok: true,
      });
    },
  );

  socket.on(
    "gateway:typing",
    async (
      payload,
      callback,
    ) => {
      try {
        if (
          !validIdentifier(
            payload?.channelId,
          )
        ) {
          callback({
            ok: false,
            code:
              "INVALID_CHANNEL",
            message:
              "Canal inválido.",
          });

          return;
        }

        const room =
          channelRoom(
            payload.channelId,
          );

        if (
          !socket.rooms.has(room)
        ) {
          callback({
            ok: false,
            code:
              "NOT_SUBSCRIBED",
            message:
              "Você não está inscrito neste canal.",
          });

          return;
        }

        const allowed =
          await consumeRateLimit(
            `typing:${user.id}:${payload.channelId}`,
            5,
            5,
          );

        if (!allowed) {
          callback({
            ok: false,
            code: "RATE_LIMITED",
            message:
              "Typing enviado muito rapidamente.",
          });

          return;
        }

        const expiresAt =
          Date.now() + 10_000;

        await stateRedis.set(
          `typecord:typing:${payload.channelId}:${user.id}`,
          String(expiresAt),
          {
            EX: 10,
          },
        );

        const dispatch =
          createDispatch(
            "TYPING_START",
            {
              channelId:
                payload.channelId,

              userId:
                user.id,

              username:
                user.username,

              globalName:
                user.globalName,

              expiresAt,
            },
          );

        socket
          .to(room)
          .emit(
            "gateway:event",
            dispatch,
          );

        callback({
          ok: true,
        });
      } catch (error) {
        console.error(
          "[TYPING_ERROR]",
          error,
        );

        callback({
          ok: false,
          code:
            "INTERNAL_ERROR",
          message:
            "Erro ao enviar typing.",
        });
      }
    },
  );

  socket.on(
    "gateway:ping",
    (callback) => {
      callback({
        ok: true,
        data: {
          serverTime:
            new Date().toISOString(),
        },
      });
    },
  );

  socket.on("gateway:set-rich-presence", async (payload, callback) => {
    try {
      if (payload === null) {
        await db.richPresence.deleteMany({ where: { userId: user.id } });
        await broadcastToGuilds(guildIds, "PRESENCE_UPDATE", { userId: user.id, richPresence: null, updatedAt: new Date().toISOString() });
        callback({ ok: true, data: { enabled: false } });
        return;
      }
      const name = typeof payload?.name === "string" ? payload.name.trim().replace(/\s+/g, " ").slice(0, 128) : "";
      if (!name) { callback({ ok: false, code: "INVALID_PRESENCE", message: "O nome da atividade é obrigatório." }); return; }
      const dates = { startedAt: payload.startedAt ? new Date(payload.startedAt) : null, endsAt: payload.endsAt ? new Date(payload.endsAt) : null, expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null };
      if (Object.values(dates).some((date) => date && Number.isNaN(date.getTime()))) { callback({ ok: false, code: "INVALID_PRESENCE", message: "Data da presença inválida." }); return; }
      const allowedTypes = new Set(["PLAYING", "LISTENING", "WATCHING", "STREAMING", "COMPETING", "CUSTOM"]);
      if (payload.type && !allowedTypes.has(payload.type)) { callback({ ok: false, code: "INVALID_PRESENCE", message: "Tipo de presença inválido." }); return; }
      const presenceData = { type: payload.type ?? "CUSTOM", name, details: payload.details?.trim().slice(0, 128) || null, state: payload.state?.trim().slice(0, 128) || null, url: payload.url?.trim().slice(0, 2048) || null, largeImageUrl: payload.largeImageUrl?.trim().slice(0, 2048) || null, smallImageUrl: payload.smallImageUrl?.trim().slice(0, 2048) || null, largeImageText: payload.largeImageText?.trim().slice(0, 128) || null, smallImageText: payload.smallImageText?.trim().slice(0, 128) || null, ...dates };
      const presence = await db.richPresence.upsert({ where: { userId: user.id }, create: { userId: user.id, ...presenceData }, update: presenceData });
      await broadcastToGuilds(guildIds, "PRESENCE_UPDATE", { userId: user.id, richPresence: { type: presence.type, name: presence.name, details: presence.details, state: presence.state, url: presence.url, largeImageUrl: presence.largeImageUrl, smallImageUrl: presence.smallImageUrl, largeImageText: presence.largeImageText, smallImageText: presence.smallImageText, startedAt: presence.startedAt?.toISOString() ?? null, endsAt: presence.endsAt?.toISOString() ?? null, expiresAt: presence.expiresAt?.toISOString() ?? null }, updatedAt: new Date().toISOString() });
      callback({ ok: true, data: { enabled: true } });
    } catch (error) { console.error("[RICH_PRESENCE_GATEWAY_ERROR]", error); callback({ ok: false, code: "INTERNAL_ERROR", message: "Não foi possível atualizar a Rich Presence." }); }
  });

  socket.on(
    "disconnect",
    async (reason) => {
      clearInterval(heartbeat);

      console.log(
        `[GATEWAY] ${kind} ${user.id} desconectado: ${reason}`,
      );

      if (kind !== "user") {
        return;
      }

      try {
        const remaining =
          await removePresence(
            user.id,
            socket.id,
          );

        if (remaining === 0) {
          await broadcastPresence(
            user.id,
            guildIds,
            "OFFLINE",
            false,
          );
        }
      } catch (error) {
        console.error(
          "[PRESENCE_DISCONNECT_ERROR]",
          error,
        );
      }
    },
  );
});

const presenceJanitor =
  setInterval(async () => {
    try {
      const lock =
        await stateRedis.set(
          "typecord:presence:janitor",
          INSTANCE_ID,
          {
            NX: true,
            EX: 20,
          },
        );

      if (!lock) {
        return;
      }

      const cutoff =
        Date.now() -
        PRESENCE_STALE_MS;

      const staleUsers =
        await stateRedis.zRangeByScore(
          PRESENCE_USERS_KEY,
          0,
          cutoff,
        );

      for (const userId of staleUsers) {
        const count =
          await cleanPresence(
            userId,
          );

        if (count > 0) {
          continue;
        }

        await stateRedis.zRem(
          PRESENCE_USERS_KEY,
          userId,
        );

        const guildIds =
          await loadGuildIds(
            userId,
          );

        await broadcastPresence(
          userId,
          guildIds,
          "OFFLINE",
          false,
        );
      }
    } catch (error) {
      console.error(
        "[PRESENCE_JANITOR_ERROR]",
        error,
      );
    }
  }, 30_000);

httpServer.on(
  "request",
  async (request, response) => {
    if (
      request.url === "/healthz"
    ) {
      try {
        await stateRedis.ping();

        response.statusCode = 200;
        response.setHeader(
          "Content-Type",
          "application/json",
        );

        response.end(
          JSON.stringify({
            status: "ok",
            service: "typecord-gateway",
            version: "socketio-user-bot-v3",
            instanceId: INSTANCE_ID,
          }),
        );
      } catch {
        response.statusCode = 503;

        response.end(
          JSON.stringify({
            status:
              "unavailable",
          }),
        );
      }

      return;
    }

    if (
      !request.url?.startsWith(
        GATEWAY_PATH,
      )
    ) {
      response.statusCode = 404;
      response.end("Not Found");
    }
  },
);

async function shutdown(
  signal: string,
) {
  console.log(
    `[GATEWAY] Encerrando por ${signal}`,
  );

  clearInterval(
    presenceJanitor,
  );

  io.disconnectSockets(true);

  await new Promise<void>(
    (resolve) => {
      io.close(() => {
        resolve();
      });
    },
  );

  await Promise.allSettled([
    pubClient.quit(),
    subClient.quit(),
    stateRedis.quit(),
    db.$disconnect(),
  ]);

  httpServer.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref();
}

process.on(
  "SIGTERM",
  () =>
    void shutdown("SIGTERM"),
);

process.on(
  "SIGINT",
  () =>
    void shutdown("SIGINT"),
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "[GATEWAY_UNHANDLED_REJECTION]",
      error,
    );
  },
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "[GATEWAY_UNCAUGHT_EXCEPTION]",
      error,
    );

    void shutdown(
      "uncaughtException",
    );
  },
);

httpServer.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `[GATEWAY] Typecord Realtime Gateway`,
    );

    console.log(
      `[GATEWAY] http://${HOST}:${PORT}`,
    );

    console.log(
      `[GATEWAY] Instance ${INSTANCE_ID}`,
    );

    console.log(
      `[GATEWAY] Origins: ${[...allowedOrigins].join(", ")}`,
    );

    console.log(
      "[GATEWAY] Auth: usuários JWT + bots GatewaySession",
    );
  },
);
