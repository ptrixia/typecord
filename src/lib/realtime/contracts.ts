export const SOCKET_IO_REDIS_KEY = "typecord:socket.io";
export const GATEWAY_PATH = "/socket.io";

export const RealtimeEvent = {
  MESSAGE_CREATE: "MESSAGE_CREATE",
  MESSAGE_UPDATE: "MESSAGE_UPDATE",
  MESSAGE_DELETE: "MESSAGE_DELETE",

  CHANNEL_CREATE: "CHANNEL_CREATE",
  CHANNEL_UPDATE: "CHANNEL_UPDATE",
  CHANNEL_DELETE: "CHANNEL_DELETE",

  GUILD_CREATE: "GUILD_CREATE",
  GUILD_UPDATE: "GUILD_UPDATE",
  GUILD_DELETE: "GUILD_DELETE",

  GUILD_MEMBER_ADD: "GUILD_MEMBER_ADD",
  GUILD_MEMBER_UPDATE: "GUILD_MEMBER_UPDATE",
  GUILD_MEMBER_REMOVE: "GUILD_MEMBER_REMOVE",

  USER_UPDATE: "USER_UPDATE",
  PRESENCE_UPDATE: "PRESENCE_UPDATE",

  TYPING_START: "TYPING_START",

  NOTIFICATION_CREATE: "NOTIFICATION_CREATE",

  VOICE_STATE_UPDATE: "VOICE_STATE_UPDATE",
} as const;

export type RealtimeEventName =
  (typeof RealtimeEvent)[keyof typeof RealtimeEvent];

export interface GatewayDispatch<T = unknown> {
  op: "DISPATCH";
  type: RealtimeEventName;
  data: T;
  eventId: string;
  emittedAt: string;
}

export interface GatewayReadyPayload {
  sessionId: string;
  userId: string;
  guildIds: string[];
  connectedAt: string;
}

export type GatewayAck<T = undefined> =
  | {
      ok: true;
      data?: T;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export interface ClientToServerEvents {
  "gateway:subscribe-channel": (
    payload: {
      channelId: string;
    },
    callback: (
      response: GatewayAck<{
        channelId: string;
      }>,
    ) => void,
  ) => void;

  "gateway:unsubscribe-channel": (
    payload: {
      channelId: string;
    },
    callback: (response: GatewayAck) => void,
  ) => void;

  "gateway:typing": (
    payload: {
      channelId: string;
    },
    callback: (response: GatewayAck) => void,
  ) => void;

  "gateway:ping": (
    callback: (
      response: GatewayAck<{
        serverTime: string;
      }>,
    ) => void,
  ) => void;
}

export interface ServerToClientEvents {
  "gateway:ready": (payload: GatewayReadyPayload) => void;

  "gateway:event": (payload: GatewayDispatch) => void;
}

export interface InterServerEvents {}