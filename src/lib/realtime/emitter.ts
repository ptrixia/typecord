import "server-only";

import {
  randomUUID,
} from "crypto";

import {
  createClient,
} from "redis";

import {
  Emitter,
} from "@socket.io/redis-emitter";

import {
  SOCKET_IO_REDIS_KEY,
  type GatewayDispatch,
  type RealtimeEventName,
  type ServerToClientEvents,
} from "@/lib/realtime/contracts";

import {
  botRoom,
  channelRoom,
  guildRoom,
  userRoom,
} from "@/lib/realtime/rooms";

type RealtimeRedisClient =
  ReturnType<
    typeof createClient
  >;

const globalRealtime =
  globalThis as unknown as {
    realtimeRedis?: RealtimeRedisClient;
    realtimeRedisConnect?: Promise<void>;
    realtimeEmitter?: Emitter<ServerToClientEvents>;
  };

function createRealtimeRedisClient() {
  const client =
    createClient({
      url:
        process.env
          .REDIS_URL ||
        "redis://localhost:6379",

      socket: {
        reconnectStrategy(
          retries,
        ) {
          return Math.min(
            100 +
              retries * 200,
            5000,
          );
        },
      },
    });

  client.on(
    "error",
    (error) => {
      console.error(
        "[REALTIME_REDIS_ERROR]",
        error,
      );
    },
  );

  return client;
}

async function getRealtimeRedis() {
  if (
    !globalRealtime
      .realtimeRedis
  ) {
    globalRealtime.realtimeRedis =
      createRealtimeRedisClient() as RealtimeRedisClient;
  }

  const client =
    globalRealtime
      .realtimeRedis;

  if (!client.isOpen) {
    if (
      !globalRealtime
        .realtimeRedisConnect
    ) {
      globalRealtime.realtimeRedisConnect =
        client
          .connect()
          .then(
            () =>
              undefined,
          )
          .finally(() => {
            globalRealtime.realtimeRedisConnect =
              undefined;
          });
    }

    await globalRealtime
      .realtimeRedisConnect;
  }

  return client;
}

async function getEmitter() {
  if (
    globalRealtime
      .realtimeEmitter
  ) {
    return globalRealtime
      .realtimeEmitter;
  }

  const redis =
    await getRealtimeRedis();

  globalRealtime.realtimeEmitter =
    new Emitter<ServerToClientEvents>(
      redis as unknown as ConstructorParameters<
        typeof Emitter
      >[0],
      {
        key:
          SOCKET_IO_REDIS_KEY,
      },
    );

  return globalRealtime
    .realtimeEmitter;
}

function createDispatch<T>(
  type: RealtimeEventName,
  data: T,
): GatewayDispatch<T> {
  return {
    op: "DISPATCH",
    type,
    data,
    eventId:
      randomUUID(),
    emittedAt:
      new Date().toISOString(),
  };
}

export async function emitToUser<T>(
  userId: string,
  type: RealtimeEventName,
  data: T,
) {
  if (!userId) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  emitter
    .to(
      userRoom(userId),
    )
    .emit(
      "gateway:event",
      dispatch,
    );

  return dispatch;
}

export async function emitToBot<T>(
  botId: string,
  type: RealtimeEventName,
  data: T,
) {
  if (!botId) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  emitter
    .to(
      botRoom(botId),
    )
    .emit(
      "gateway:event",
      dispatch,
    );

  return dispatch;
}

export async function emitToBots<T>(
  botIds: string[],
  type: RealtimeEventName,
  data: T,
) {
  const uniqueBotIds = [
    ...new Set(
      botIds.filter(
        (
          botId,
        ): botId is string =>
          typeof botId ===
            "string" &&
          botId.length > 0,
      ),
    ),
  ];

  if (
    uniqueBotIds.length ===
    0
  ) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  for (
    const botId of
    uniqueBotIds
  ) {
    emitter
      .to(
        botRoom(botId),
      )
      .emit(
        "gateway:event",
        dispatch,
      );
  }

  return dispatch;
}

export async function emitToGuild<T>(
  guildId: string,
  type: RealtimeEventName,
  data: T,
) {
  if (!guildId) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  emitter
    .to(
      guildRoom(guildId),
    )
    .emit(
      "gateway:event",
      dispatch,
    );

  return dispatch;
}

export async function emitToChannel<T>(
  channelId: string,
  type: RealtimeEventName,
  data: T,
) {
  if (!channelId) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  emitter
    .to(
      channelRoom(
        channelId,
      ),
    )
    .emit(
      "gateway:event",
      dispatch,
    );

  return dispatch;
}

export async function emitToGuilds<T>(
  guildIds: string[],
  type: RealtimeEventName,
  data: T,
) {
  const uniqueGuildIds = [
    ...new Set(
      guildIds.filter(
        (
          guildId,
        ): guildId is string =>
          typeof guildId ===
            "string" &&
          guildId.length > 0,
      ),
    ),
  ];

  if (
    uniqueGuildIds.length ===
    0
  ) {
    return null;
  }

  const emitter =
    await getEmitter();

  const dispatch =
    createDispatch(
      type,
      data,
    );

  for (
    const guildId of
    uniqueGuildIds
  ) {
    emitter
      .to(
        guildRoom(
          guildId,
        ),
      )
      .emit(
        "gateway:event",
        dispatch,
      );
  }

  return dispatch;
}

export async function attachUserToGuildRealtime(
  userId: string,
  guildId: string,
) {
  if (
    !userId ||
    !guildId
  ) {
    return;
  }

  const emitter =
    await getEmitter();

  emitter
    .in(
      userRoom(userId),
    )
    .socketsJoin(
      guildRoom(guildId),
    );
}

export async function refreshUserRealtime(
  userId: string,
) {
  if (!userId) {
    return;
  }

  const emitter =
    await getEmitter();

  emitter
    .in(
      userRoom(userId),
    )
    .disconnectSockets(
      true,
    );
}