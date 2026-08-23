export type GatewayEvent =
  | "READY"
  | "MESSAGE_CREATE"
  | "MESSAGE_UPDATE"
  | "MESSAGE_DELETE"
  | "GUILD_CREATE"
  | "GUILD_UPDATE"
  | "GUILD_DELETE"
  | "CHANNEL_CREATE"
  | "CHANNEL_UPDATE"
  | "CHANNEL_DELETE"
  | "GUILD_MEMBER_ADD"
  | "GUILD_MEMBER_REMOVE"
  | "VOICE_STATE_UPDATE";

export interface GatewayPayload<T = unknown> {
  op: number;
  t: GatewayEvent;
  s: number;
  d: T;
}