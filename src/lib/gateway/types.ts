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
  | "VOICE_STATE_UPDATE"
  | "SOUNDBOARD_PLAY";

export interface GatewaySession {
  id: string;
  botId: string;
  userId: string;
  createdAt: Date;
  lastHeartbeatAt: Date;
  expiresAt: Date;
}

export interface GatewayEventPayload<T = unknown> {
  op: number;
  t: GatewayEvent;
  s: number;
  d: T;
}
