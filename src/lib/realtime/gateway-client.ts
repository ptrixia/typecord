"use client";

import {
  io,
  type Socket,
} from "socket.io-client";

import {
  GATEWAY_PATH,
  type ClientToServerEvents,
  type GatewayDispatch,
  type GatewayReadyPayload,
  type RealtimeEventName,
  type ServerToClientEvents,
} from "@/lib/realtime/contracts";

type GatewaySocket =
  Socket<
    ServerToClientEvents,
    ClientToServerEvents
  >;

type GatewayConnectError =
  Error & {
    data?: {
      code?: string;
      message?: string;
    };
  };

export type GatewayConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

export type GatewayConnectionStatus = {
  state: GatewayConnectionState;
  message?: string;
};

const gatewayEvents =
  new EventTarget();

const gatewayStatusEvents =
  new EventTarget();

const seenEvents =
  new Map<
    string,
    number
  >();

const MAX_SEEN_EVENTS =
  1000;

const subscribedChannels =
  new Set<string>();

let socket:
  | GatewaySocket
  | null = null;

let ready:
  | GatewayReadyPayload
  | null = null;

let gatewayStatus: GatewayConnectionStatus = {
  state: "idle",
};

function setGatewayStatus(status: GatewayConnectionStatus) {
  gatewayStatus = status;
  gatewayStatusEvents.dispatchEvent(
    new CustomEvent<GatewayConnectionStatus>(
      "__GATEWAY_STATUS__",
      {
        detail: status,
      },
    ),
  );
}

async function requestToken(): Promise<string> {
  const response =
    await fetch(
      "/api/realtime/token",
      {
        method: "GET",
        credentials:
          "same-origin",
        cache:
          "no-store",
      },
    );

  const body =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Falha HTTP ao obter token realtime (${response.status}): ${body.slice(
        0,
        500,
      )}`,
    );
  }

  let data: unknown;

  try {
    data =
      JSON.parse(body);
  } catch {
    throw new Error(
      `Resposta inválida de /api/realtime/token: ${body.slice(
        0,
        500,
      )}`,
    );
  }

  const payload =
    data as {
      success?: unknown;
      token?: unknown;
    };

  if (
    payload.success !==
      true ||
    typeof payload.token !==
      "string" ||
    !payload.token.trim()
  ) {
    throw new Error(
      "Resposta de token realtime inválida ou vazia.",
    );
  }

  return payload.token;
}

function isDuplicate(
  dispatch: GatewayDispatch,
) {
  const eventId =
    dispatch.eventId;

  if (!eventId) {
    return false;
  }

  if (
    seenEvents.has(
      eventId,
    )
  ) {
    return true;
  }

  seenEvents.set(
    eventId,
    Date.now(),
  );

  if (
    seenEvents.size >
    MAX_SEEN_EVENTS
  ) {
    const oldest =
      seenEvents
        .keys()
        .next()
        .value;

    if (oldest) {
      seenEvents.delete(
        oldest,
      );
    }
  }

  return false;
}

export function getGatewaySocket() {
  if (socket) {
    return socket;
  }

  const url =
    process.env
      .NEXT_PUBLIC_GATEWAY_URL;

  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_GATEWAY_URL não configurada.",
    );
  }

  socket = io(url, {
    path:
      GATEWAY_PATH,

    autoConnect:
      false,

    transports: [
      "websocket",
    ],

    reconnection:
      true,

    reconnectionAttempts:
      Infinity,

    reconnectionDelay:
      500,

    reconnectionDelayMax:
      10_000,

    randomizationFactor:
      0.5,

    timeout:
      10_000,

    auth: async (
      callback,
    ) => {
      try {
        const token =
          await requestToken();

        callback({
          token,
        });
      } catch (error) {
        console.error(
          "[GATEWAY_AUTH_TOKEN_ERROR]",
          error,
        );

        callback({});
      }
    },
  });

  setGatewayStatus({
    state: "connecting",
  });

  socket.on(
    "connect",
    () => {
      setGatewayStatus({
        state: "connected",
      });

      console.log(
        "[GATEWAY_CONNECTED]",
        {
          socketId:
            socket?.id,
          url,
          path:
            GATEWAY_PATH,
        },
      );
    },
  );

  socket.on(
    "gateway:ready",
    (payload) => {
      ready =
        payload;

      console.log(
        "[GATEWAY_READY]",
        payload,
      );

      gatewayEvents.dispatchEvent(
        new CustomEvent(
          "__READY__",
          {
            detail:
              payload,
          },
        ),
      );

      for (const channelId of subscribedChannels) {
        void emitSubscribeChannel(channelId).catch((error) => {
          console.error(
            "[GATEWAY_CHANNEL_RESUBSCRIBE]",
            error,
          );
        });
      }
    },
  );

  socket.on("gateway:event", (dispatch) => {
  console.log(
    "[GATEWAY_RAW_EVENT]",
    dispatch,
  );

  if (isDuplicate(dispatch)) {
    console.log(
      "[GATEWAY_DUPLICATE_EVENT]",
      dispatch.eventId,
    );

    return;
  }

  console.log(
    "[GATEWAY_DISPATCH_EVENT]",
    dispatch.type,
    dispatch.data,
  );

  gatewayEvents.dispatchEvent(
    new CustomEvent(
      dispatch.type,
      {
        detail: dispatch,
      },
    ),
  );
});

  socket.on(
    "connect_error",
    (
      rawError,
    ) => {
      const error =
        rawError as GatewayConnectError;

      setGatewayStatus({
        state: "error",
        message:
          error.data?.message ??
          error.message ??
          "Não foi possível conectar ao Gateway.",
      });

      console.error(
        "[GATEWAY_CONNECT_ERROR]",
        {
          message:
            error.message,
          name:
            error.name,
          code:
            error.data?.code,
          data:
            error.data,
          url,
          path:
            GATEWAY_PATH,
          origin:
            typeof window !==
            "undefined"
              ? window.location
                  .origin
              : undefined,
        },
      );
    },
  );

  socket.on(
    "disconnect",
    (reason) => {
      ready = null;

      setGatewayStatus({
        state:
          reason === "io server disconnect"
            ? "disconnected"
            : "reconnecting",
        message: reason,
      });

      console.log(
        "[GATEWAY_DISCONNECTED]",
        reason,
      );
    },
  );

  return socket;
}

async function emitSubscribeChannel(channelId: string) {
  const current =
    await waitForGatewayConnection();

  return new Promise<void>(
    (
      resolve,
      reject,
    ) => {
      current.emit(
        "gateway:subscribe-channel",
        {
          channelId,
        },
        (
          response,
        ) => {
          if (
            !response.ok
          ) {
            reject(
              new Error(
                response.message,
              ),
            );
            return;
          }

          console.log(
            "[GATEWAY_CHANNEL_SUBSCRIBED]",
            channelId,
          );

          resolve();
        },
      );
    },
  );
}

export function connectGateway() {
  const current =
    getGatewaySocket();

  if (
    !current.connected &&
    !current.active
  ) {
    current.connect();
  }

  return current;
}

export function disconnectGateway() {
  if (!socket) {
    return;
  }

  socket.removeAllListeners();
  socket.disconnect();

  socket = null;
  ready = null;

  seenEvents.clear();
  subscribedChannels.clear();
}

export function getGatewayReady() {
  return ready;
}

export function getGatewayStatus() {
  return gatewayStatus;
}

export function onGatewayStatus(
  handler: (status: GatewayConnectionStatus) => void,
) {
  const listener = (event: Event) => {
    handler((event as CustomEvent<GatewayConnectionStatus>).detail);
  };

  gatewayStatusEvents.addEventListener("__GATEWAY_STATUS__", listener);
  handler(gatewayStatus);

  return () => {
    gatewayStatusEvents.removeEventListener("__GATEWAY_STATUS__", listener);
  };
}

export function waitForGatewayConnection(
  timeoutMs = 10_000,
) {
  const current =
    connectGateway();

  if (
    current.connected
  ) {
    return Promise.resolve(
      current,
    );
  }

  return new Promise<GatewaySocket>(
    (
      resolve,
      reject,
    ) => {
      const timeout =
        window.setTimeout(
          () => {
            cleanup();

            reject(
              new Error(
                "Tempo limite ao conectar ao Gateway.",
              ),
            );
          },
          timeoutMs,
        );

      const handleConnect =
        () => {
          cleanup();
          resolve(current);
        };

      const handleError =
        (
          error: Error,
        ) => {
          cleanup();
          reject(error);
        };

      function cleanup() {
        window.clearTimeout(
          timeout,
        );

        current.off(
          "connect",
          handleConnect,
        );

        current.off(
          "connect_error",
          handleError,
        );
      }

      current.once(
        "connect",
        handleConnect,
      );

      current.once(
        "connect_error",
        handleError,
      );
    },
  );
}

export async function subscribeChannel(
  channelId: string,
) {
  if (!channelId) {
    throw new Error(
      "Canal inválido.",
    );
  }

  subscribedChannels.add(channelId);

  return emitSubscribeChannel(channelId);
}

export async function unsubscribeChannel(
  channelId: string,
) {
  if (
    !channelId
  ) {
    return;
  }

  subscribedChannels.delete(channelId);

  if (
    !socket ||
    !socket.connected
  ) {
    return;
  }

  return new Promise<void>(
    (resolve) => {
      socket!.emit(
        "gateway:unsubscribe-channel",
        {
          channelId,
        },
        () => {
          console.log(
            "[GATEWAY_CHANNEL_UNSUBSCRIBED]",
            channelId,
          );

          resolve();
        },
      );
    },
  );
}

export async function sendTyping(
  channelId: string,
) {
  if (!channelId) {
    return;
  }

  const current =
    await waitForGatewayConnection();

  current.emit(
    "gateway:typing",
    {
      channelId,
    },
    () => undefined,
  );
}

export function onGatewayEvent<T>(
  type: RealtimeEventName,
  handler: (
    dispatch:
      GatewayDispatch<T>,
  ) => void,
) {
  const listener =
    (
      event: Event,
    ) => {
      const custom =
        event as CustomEvent<
          GatewayDispatch<T>
        >;

      handler(
        custom.detail,
      );
    };

  gatewayEvents.addEventListener(
    type,
    listener,
  );

  connectGateway();

  return () => {
    gatewayEvents.removeEventListener(
      type,
      listener,
    );
  };
}
