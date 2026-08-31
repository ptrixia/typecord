import { io, type Socket } from "socket.io-client";

export const GatewayEvents = {
  Ready: "READY",
  MessageCreate: "MESSAGE_CREATE",
  MessageUpdate: "MESSAGE_UPDATE",
  MessageDelete: "MESSAGE_DELETE",
  MessageReactionAdd: "MESSAGE_REACTION_ADD",
  MessageReactionRemove: "MESSAGE_REACTION_REMOVE",
  GuildCreate: "GUILD_CREATE",
  GuildUpdate: "GUILD_UPDATE",
  GuildDelete: "GUILD_DELETE",
  GuildRoleCreate: "GUILD_ROLE_CREATE",
  GuildRoleUpdate: "GUILD_ROLE_UPDATE",
  GuildRoleDelete: "GUILD_ROLE_DELETE",
  GuildBanAdd: "GUILD_BAN_ADD",
  GuildBanRemove: "GUILD_BAN_REMOVE",
  InviteCreate: "INVITE_CREATE",
  InviteDelete: "INVITE_DELETE",
  ChannelCreate: "CHANNEL_CREATE",
  ChannelUpdate: "CHANNEL_UPDATE",
  ChannelDelete: "CHANNEL_DELETE",
  GuildMemberAdd: "GUILD_MEMBER_ADD",
  GuildMemberUpdate: "GUILD_MEMBER_UPDATE",
  GuildMemberRemove: "GUILD_MEMBER_REMOVE",
  UserUpdate: "USER_UPDATE",
  PresenceUpdate: "PRESENCE_UPDATE",
  TypingStart: "TYPING_START",
  NotificationCreate: "NOTIFICATION_CREATE",
  VoiceStateUpdate: "VOICE_STATE_UPDATE",
} as const;

export const Events = {
  ClientReady: "ready",
  Raw: "raw",
  Debug: "debug",
  Warn: "warn",
  Error: "error",
  Disconnect: "disconnect",
  ReconnectAttempt: "reconnectAttempt",
  MessageCreate: "messageCreate",
  MessageUpdate: "messageUpdate",
  MessageDelete: "messageDelete",
  MessageReactionAdd: "messageReactionAdd",
  MessageReactionRemove: "messageReactionRemove",
  GuildCreate: "guildCreate",
  GuildUpdate: "guildUpdate",
  GuildDelete: "guildDelete",
  GuildRoleCreate: "guildRoleCreate",
  GuildRoleUpdate: "guildRoleUpdate",
  GuildRoleDelete: "guildRoleDelete",
  GuildBanAdd: "guildBanAdd",
  GuildBanRemove: "guildBanRemove",
  InviteCreate: "inviteCreate",
  InviteDelete: "inviteDelete",
  ChannelCreate: "channelCreate",
  ChannelUpdate: "channelUpdate",
  ChannelDelete: "channelDelete",
  GuildMemberAdd: "guildMemberAdd",
  GuildMemberUpdate: "guildMemberUpdate",
  GuildMemberRemove: "guildMemberRemove",
  UserUpdate: "userUpdate",
  PresenceUpdate: "presenceUpdate",
  TypingStart: "typingStart",
  NotificationCreate: "notificationCreate",
  VoiceStateUpdate: "voiceStateUpdate",
} as const;

export type GatewayEvent = (typeof GatewayEvents)[keyof typeof GatewayEvents];
export type ClientEvent = (typeof Events)[keyof typeof Events];

export type RichPresenceType =
  | "PLAYING"
  | "LISTENING"
  | "WATCHING"
  | "STREAMING"
  | "COMPETING"
  | "CUSTOM";

export interface RichPresenceOptions {
  type?: RichPresenceType;
  name?: string;
  details?: string | null;
  state?: string | null;
  url?: string | null;
  startedAt?: string | null;
  endsAt?: string | null;
  expiresAt?: string | null;
  largeImageUrl?: string | null;
  smallImageUrl?: string | null;
  largeImageText?: string | null;
  smallImageText?: string | null;
}

export type GatewayAck<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; code: string; message: string };

export interface GatewayDispatch<T = unknown> {
  op: "DISPATCH";
  type: GatewayEvent;
  data: T;
  eventId?: string;
  emittedAt?: string;
}

export interface User {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  bot?: boolean;
  verifiedBot?: boolean;
  raw?: unknown;
}

export interface Guild {
  id: string;
  name: string;
  iconUrl: string | null;
  raw?: unknown;
}

export interface Channel {
  id: string;
  guildId?: string;
  name?: string;
  type?: string;
  raw?: unknown;
}

export interface GuildMember {
  id?: string;
  userId: string;
  guildId: string;
  user: User;
  nickname?: string | null;
  roles?: unknown[];
  raw?: unknown;
}

export interface MessageAttachment {
  id?: string;
  url?: string | null;
  key?: string | null;
  filename?: string;
  name?: string;
  fileSize?: number;
  size?: number;
  fileType?: string;
  contentType?: string;
}

export interface EmbedData {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  timestamp?: string;
  author?: { name: string; url?: string; iconUrl?: string };
  footer?: { text: string; iconUrl?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}

export type MessageCreateOptions = {
  content?: string;
  replyToId?: string | null;
  embeds?: Array<EmbedData | EmbedBuilder>;
};

export interface MessagePayload {
  id: string;
  content: string;
  guildId: string;
  channelId: string;
  author: User;
  authorId?: string;
  isBot?: boolean;
  isBotVerified?: boolean;
  isWebhook?: boolean;
  attachments: MessageAttachment[];
  embeds: EmbedData[];
  createdAt: string;
  editedAt?: string | null;
  replyToId?: string | null;
  reply?: unknown;
  deleted?: boolean;
  raw?: unknown;
}

export interface GatewayReadyPayload {
  sessionId?: string;
  userId?: string;
  guildIds?: string[];
  connectedAt?: string;
  bot?: { id?: string; user?: RawUser };
  guilds?: RawGuild[];
}

export interface ClientReady {
  sessionId?: string;
  user: User;
  guilds: Collection<string, Guild>;
  raw: GatewayReadyPayload;
}

export interface TypecordClientOptions {
  apiUrl?: string;
  gatewayUrl?: string;
  gatewayPath?: string;
  token?: string;
  requestTimeoutMs?: number;
  sessionRefreshMarginMs?: number;
  maxSeenEvents?: number;
  autoReconnect?: boolean;
}

export interface GatewaySession {
  id: string;
  token: string;
  expiresAt: string;
}

export interface GatewaySessionResponse {
  success?: boolean;
  url?: string;
  session: GatewaySession;
  bot: { id: string; user: RawUser };
  guilds: RawGuild[];
}

export type RawUser = Record<string, any>;
export type RawGuild = Record<string, any>;

type GatewayServerToClientEvents = {
  "gateway:ready": (payload: GatewayReadyPayload) => void;
  "gateway:event": (payload: GatewayDispatch) => void;
};

type GatewayClientToServerEvents = {
  "gateway:ping": (callback: (response: GatewayAck<{ serverTime: string }>) => void) => void;
  "gateway:set-rich-presence": (
    payload: RichPresenceOptions | null,
    callback: (response: GatewayAck<{ enabled: boolean }>) => void,
  ) => void;
};

export type EventMap = {
  [Events.ClientReady]: [ClientReady];
  [Events.Raw]: [GatewayDispatch];
  [Events.Debug]: [string];
  [Events.Warn]: [string];
  [Events.Error]: [Error];
  [Events.Disconnect]: [string];
  [Events.ReconnectAttempt]: [number];
  [Events.MessageCreate]: [Message];
  [Events.MessageUpdate]: [Message | unknown];
  [Events.MessageDelete]: [unknown];
  [Events.MessageReactionAdd]: [unknown];
  [Events.MessageReactionRemove]: [unknown];
  [Events.GuildCreate]: [Guild | unknown];
  [Events.GuildUpdate]: [Guild | unknown];
  [Events.GuildDelete]: [unknown];
  [Events.GuildRoleCreate]: [unknown];
  [Events.GuildRoleUpdate]: [unknown];
  [Events.GuildRoleDelete]: [unknown];
  [Events.GuildBanAdd]: [unknown];
  [Events.GuildBanRemove]: [unknown];
  [Events.InviteCreate]: [unknown];
  [Events.InviteDelete]: [unknown];
  [Events.ChannelCreate]: [Channel | unknown];
  [Events.ChannelUpdate]: [Channel | unknown];
  [Events.ChannelDelete]: [unknown];
  [Events.GuildMemberAdd]: [GuildMember];
  [Events.GuildMemberUpdate]: [GuildMember | unknown];
  [Events.GuildMemberRemove]: [unknown];
  [Events.UserUpdate]: [User | unknown];
  [Events.PresenceUpdate]: [unknown];
  [Events.TypingStart]: [unknown];
  [Events.NotificationCreate]: [unknown];
  [Events.VoiceStateUpdate]: [unknown];
};

type Listener<T extends unknown[]> = (...args: T) => void | Promise<void>;

export class Collection<K, V> extends Map<K, V> {
  first() {
    return this.values().next().value as V | undefined;
  }

  filter(predicate: (value: V, key: K, collection: this) => boolean) {
    const filtered = new Collection<K, V>();

    for (const [key, value] of this) {
      if (predicate(value, key, this)) {
        filtered.set(key, value);
      }
    }

    return filtered;
  }

  mapValues<T>(mapper: (value: V, key: K, collection: this) => T) {
    const values: T[] = [];

    for (const [key, value] of this) {
      values.push(mapper(value, key, this));
    }

    return values;
  }
}

class TypedEmitter<EventsShape extends Record<string, unknown[]>> {
  private listeners = new Map<keyof EventsShape, Set<Listener<any>>>();

  on<K extends keyof EventsShape>(event: K, listener: Listener<EventsShape[K]>) {
    const bucket = this.listeners.get(event) ?? new Set<Listener<any>>();
    bucket.add(listener);
    this.listeners.set(event, bucket);
    return this;
  }

  once<K extends keyof EventsShape>(event: K, listener: Listener<EventsShape[K]>) {
    const onceListener: Listener<EventsShape[K]> = (...args) => {
      this.off(event, onceListener);
      return listener(...args);
    };

    return this.on(event, onceListener);
  }

  off<K extends keyof EventsShape>(event: K, listener: Listener<EventsShape[K]>) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  removeAllListeners<K extends keyof EventsShape>(event?: K) {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
    return this;
  }

  protected emit<K extends keyof EventsShape>(event: K, ...args: EventsShape[K]) {
    const bucket = this.listeners.get(event);
    if (!bucket) return false;

    for (const listener of [...bucket]) {
      void Promise.resolve(listener(...args)).catch((error) => {
        if (event !== Events.Error) {
          const errorBucket = this.listeners.get(Events.Error as keyof EventsShape);

          for (const errorListener of [...(errorBucket ?? [])]) {
            void Promise.resolve(errorListener(toError(error)));
          }
        }
      });
    }

    return true;
  }
}

export class EmbedBuilder {
  private data: EmbedData = {};

  constructor(data?: EmbedData) {
    if (data) this.data = { ...data };
  }

  setTitle(title: string) {
    this.data.title = title;
    return this;
  }

  setDescription(description: string) {
    this.data.description = description;
    return this;
  }

  setURL(url: string) {
    this.data.url = url;
    return this;
  }

  setColor(color: string) {
    this.data.color = color;
    return this;
  }

  setTimestamp(timestamp: string | Date = new Date()) {
    this.data.timestamp = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
    return this;
  }

  setAuthor(author: EmbedData["author"]) {
    this.data.author = author;
    return this;
  }

  setFooter(footer: EmbedData["footer"]) {
    this.data.footer = footer;
    return this;
  }

  setImage(url: string) {
    this.data.image = { url };
    return this;
  }

  setThumbnail(url: string) {
    this.data.thumbnail = { url };
    return this;
  }

  addFields(...fields: NonNullable<EmbedData["fields"]>) {
    this.data.fields = [...(this.data.fields ?? []), ...fields];
    return this;
  }

  toJSON(): EmbedData {
    return {
      ...this.data,
      fields: this.data.fields ? [...this.data.fields] : undefined,
    };
  }
}

export class Message {
  readonly client: TypecordClient;
  readonly id: string;
  readonly content: string;
  readonly guildId: string;
  readonly channelId: string;
  readonly author: User;
  readonly attachments: MessageAttachment[];
  readonly embeds: EmbedData[];
  readonly createdAt: Date;
  readonly editedAt: Date | null;
  readonly replyToId: string | null;
  readonly deleted: boolean;
  readonly raw: unknown;

  constructor(client: TypecordClient, payload: MessagePayload) {
    this.client = client;
    this.id = payload.id;
    this.content = payload.content;
    this.guildId = payload.guildId;
    this.channelId = payload.channelId;
    this.author = payload.author;
    this.attachments = payload.attachments;
    this.embeds = payload.embeds;
    this.createdAt = new Date(payload.createdAt);
    this.editedAt = payload.editedAt ? new Date(payload.editedAt) : null;
    this.replyToId = payload.replyToId ?? null;
    this.deleted = Boolean(payload.deleted);
    this.raw = payload.raw ?? payload;
  }

  get createdTimestamp() {
    return this.createdAt.getTime();
  }

  get inGuild() {
    return Boolean(this.guildId);
  }

  reply(options: string | MessageCreateOptions) {
    return this.client.channels.send(this.channelId, normalizeSendOptions(options, this.id));
  }

  edit(options: string | MessageCreateOptions) {
    return this.client.rest.editMessage(this.channelId, this.id, normalizeSendOptions(options));
  }

  delete() {
    return this.client.rest.deleteMessage(this.channelId, this.id);
  }
}

export class ChannelManager {
  private readonly client: TypecordClient;

  constructor(client: TypecordClient) {
    this.client = client;
  }

  send(channelId: string, options: string | MessageCreateOptions) {
    return this.client.rest.createMessage(channelId, normalizeSendOptions(options));
  }
}

export interface CommandContext {
  client: TypecordClient;
  message: Message;
  name: string;
  args: string[];
  content: string;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description?: string;
  execute: (context: CommandContext) => void | Promise<void>;
}

export class CommandRouter {
  private prefix = "!";
  private commands = new Collection<string, CommandDefinition>();
  private aliases = new Map<string, string>();
  private readonly client: TypecordClient;

  constructor(client: TypecordClient) {
    this.client = client;
  }

  setPrefix(prefix: string) {
    this.prefix = prefix;
    return this;
  }

  register(command: CommandDefinition) {
    const name = command.name.toLowerCase();
    this.commands.set(name, { ...command, name });

    for (const alias of command.aliases ?? []) {
      this.aliases.set(alias.toLowerCase(), name);
    }

    return this;
  }

  get(name: string) {
    return this.commands.get(this.aliases.get(name.toLowerCase()) ?? name.toLowerCase());
  }

  list() {
    return [...this.commands.values()];
  }

  async handle(message: Message) {
    if (!message.content.startsWith(this.prefix)) return false;

    const content = message.content.slice(this.prefix.length).trim();
    if (!content) return false;

    const [rawName, ...args] = content.split(/\s+/);
    const name = rawName.toLowerCase();
    const command = this.get(name);
    if (!command) return false;

    await command.execute({
      client: this.client,
      message,
      name,
      args,
      content,
    });

    return true;
  }
}

export class RestManager {
  private readonly client: TypecordClient;

  constructor(client: TypecordClient) {
    this.client = client;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const timeout = createTimeoutSignal(this.client.options.requestTimeoutMs);

    try {
      const response = await fetch(`${this.client.apiUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bot ${this.client.token}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        cache: "no-store",
        signal: timeout.signal,
      });

      const body = await response.text();

      if (!response.ok) {
        throw new TypecordAPIError(response.status, body, path);
      }

      return body ? (JSON.parse(body) as T) : null;
    } finally {
      timeout.clear();
    }
  }

  async createGatewaySession() {
    const data = await this.request<GatewaySessionResponse>("/api/gateway", {
      method: "GET",
    });

    if (!data?.session?.id || !data.session.token || !data.session.expiresAt) {
      throw new Error("/api/gateway nao retornou uma sessao valida.");
    }

    if (!data.bot?.id || !data.bot.user?.id || !data.bot.user.username) {
      throw new Error("/api/gateway nao retornou dados validos do bot.");
    }

    return data;
  }

  async createMessage(channelId: string, options: MessageCreateOptions) {
    const data = await this.request<{ success?: boolean; message?: unknown }>(
      `/api/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: "POST",
        body: JSON.stringify(serializeMessageOptions(options)),
      },
    );

    const message = normalizeMessagePayload(this.client, data?.message);
    return message ?? data;
  }

  async editMessage(channelId: string, messageId: string, options: MessageCreateOptions) {
    const data = await this.request<{ success?: boolean; message?: unknown }>(
      `/api/channels/${encodeURIComponent(channelId)}/messages?messageId=${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(serializeMessageOptions(options)),
      },
    );

    const message = normalizeMessagePayload(this.client, data?.message);
    return message ?? data;
  }

  async deleteMessage(channelId: string, messageId: string) {
    return this.request(
      `/api/channels/${encodeURIComponent(channelId)}/messages?messageId=${encodeURIComponent(messageId)}`,
      { method: "DELETE" },
    );
  }
}

export class TypecordAPIError extends Error {
  readonly status: number;
  readonly body: string;
  readonly path: string;

  constructor(status: number, body: string, path: string) {
    super(`Typecord API error ${status} on ${path}: ${body.slice(0, 500)}`);
    this.name = "TypecordAPIError";
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

export class TypecordClient extends TypedEmitter<EventMap> {
  readonly options: Required<Omit<TypecordClientOptions, "token">>;
  readonly rest = new RestManager(this);
  readonly channels = new ChannelManager(this);
  readonly commands = new CommandRouter(this);
  readonly guilds = new Collection<string, Guild>();
  readonly ws = {
    ping: 0,
    status: "idle" as "idle" | "connecting" | "ready" | "disconnected",
  };

  token = "";
  user: User | null = null;
  botId: string | null = null;
  readyAt: Date | null = null;

  private socket: Socket<GatewayServerToClientEvents, GatewayClientToServerEvents> | null = null;
  private session: GatewaySession | null = null;
  private sessionPromise: Promise<GatewaySessionResponse> | null = null;
  private seenEvents = new Map<string, number>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private desiredRichPresence: RichPresenceOptions | null = null;

  constructor(options: TypecordClientOptions = {}) {
    super();

    this.options = {
      apiUrl: stripTrailingSlash(options.apiUrl || "http://localhost:3000"),
      gatewayUrl: stripTrailingSlash(
        options.gatewayUrl ||
          process.env.TYPECORD_GATEWAY_URL ||
          process.env.NEXT_PUBLIC_GATEWAY_URL ||
          "http://localhost:3001",
      ),
      gatewayPath: options.gatewayPath || "/socket.io",
      requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
      sessionRefreshMarginMs: options.sessionRefreshMarginMs ?? 30_000,
      maxSeenEvents: options.maxSeenEvents ?? 5_000,
      autoReconnect: options.autoReconnect ?? true,
    };

    if (options.token) {
      this.token = options.token;
    }
  }

  get apiUrl() {
    return this.options.apiUrl;
  }

  get gatewayUrl() {
    return this.options.gatewayUrl;
  }

  async login(token = this.token) {
    this.token = token?.trim() ?? "";

    if (!this.token) {
      throw new Error("Token de bot ausente.");
    }

    this.ws.status = "connecting";
    const gateway = await this.getGatewaySession(true);

    this.botId = gateway.bot.id;
    this.user = normalizeUser(gateway.bot.user);
    this.guilds.clear();

    for (const guild of gateway.guilds ?? []) {
      const normalized = normalizeGuild(guild);
      if (normalized) this.guilds.set(normalized.id, normalized);
    }

    this.connectSocket(gateway.url || this.options.gatewayUrl);
    return this.token;
  }

  destroy() {
    this.ws.status = "disconnected";

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.session = null;
  }

  emitDebug(message: string) {
    this.emit(Events.Debug, message);
  }

  /**
   * Define a presenca publica do bot. A presenca e reaplicada automaticamente
   * quando o SDK reconecta ao Gateway.
   */
  async setRichPresence(presence: RichPresenceOptions): Promise<{ enabled: boolean }> {
    this.desiredRichPresence = { ...presence };
    return this.sendRichPresence(this.desiredRichPresence);
  }

  /** Remove a presenca publica atual do bot. */
  async clearRichPresence(): Promise<{ enabled: boolean }> {
    this.desiredRichPresence = null;
    return this.sendRichPresence(null);
  }

  private connectSocket(url: string) {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();

    const socket = io(stripTrailingSlash(url), {
      path: this.options.gatewayPath,
      transports: ["websocket"],
      autoConnect: false,
      reconnection: this.options.autoReconnect,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 15_000,
      randomizationFactor: 0.5,
      timeout: 15_000,
      forceNew: true,
      auth: async (callback) => {
        try {
          const gateway = await this.getGatewaySession();
          callback({
            token: gateway.session.token,
            sessionId: gateway.session.id,
            kind: "bot",
          });
        } catch (error) {
          this.emit(Events.Error, toError(error));
          callback({ token: "", sessionId: "", kind: "bot" });
        }
      },
    }) as Socket<GatewayServerToClientEvents, GatewayClientToServerEvents>;

    this.socket = socket;

    socket.on("connect", () => {
      this.ws.status = "connecting";
      this.startPing();
      this.emitDebug(`Gateway conectado: ${url}`);
    });

    socket.on("gateway:ready", (payload) => {
      this.handleReady(payload);
    });

    socket.on("gateway:event", (payload) => {
      this.handleDispatch(payload);
    });

    socket.on("disconnect", (reason) => {
      this.ws.status = "disconnected";
      this.emit(Events.Disconnect, reason);

      if (reason === "io server disconnect") {
        this.session = null;
        if (this.options.autoReconnect) socket.connect();
      }
    });

    socket.on("connect_error", (error) => {
      this.emit(Events.Error, error);

      const code = String((error as Error & { data?: { code?: unknown } }).data?.code ?? "");
      if (code.includes("AUTH") || code.includes("SESSION") || /token|session|auth/i.test(error.message)) {
        this.session = null;
      }
    });

    socket.io.on("reconnect_attempt", (attempt) => {
      this.emit(Events.ReconnectAttempt, attempt);
    });

    socket.connect();
  }

  private async getGatewaySession(forceRefresh = false) {
    if (!forceRefresh && isSessionUsable(this.session, this.options.sessionRefreshMarginMs)) {
      return {
        session: this.session!,
        bot: {
          id: this.botId ?? "",
          user: {
            id: this.user?.id ?? "",
            username: this.user?.username ?? "cached",
            globalName: this.user?.globalName ?? null,
            avatarUrl: this.user?.avatarUrl ?? null,
          },
        },
        guilds: [],
        url: this.options.gatewayUrl,
      } satisfies GatewaySessionResponse;
    }

    if (!this.sessionPromise) {
      this.sessionPromise = this.rest.createGatewaySession().finally(() => {
        this.sessionPromise = null;
      });
    }

    const gateway = await this.sessionPromise;
    this.session = gateway.session;
    return gateway;
  }

  private handleReady(payload: GatewayReadyPayload) {
    if (payload.bot?.user) this.user = normalizeUser(payload.bot.user);
    if (payload.bot?.id) this.botId = payload.bot.id;
    if (payload.guilds) {
      this.guilds.clear();
      for (const guild of payload.guilds) {
        const normalized = normalizeGuild(guild);
        if (normalized) this.guilds.set(normalized.id, normalized);
      }
    }

    this.readyAt = new Date();
    this.ws.status = "ready";

    this.emit(Events.ClientReady, {
      sessionId: payload.sessionId,
      user: this.user ?? normalizeUser({ id: payload.userId ?? "", username: "bot" }),
      guilds: this.guilds,
      raw: payload,
    });

    if (this.desiredRichPresence) {
      void this.sendRichPresence(this.desiredRichPresence).catch((error) => {
        this.emit(Events.Error, toError(error));
      });
    }
  }

  private sendRichPresence(presence: RichPresenceOptions | null) {
    if (!this.socket || !this.socket.connected || this.ws.status !== "ready") {
      return Promise.reject(new Error("O Gateway ainda nao esta pronto para atualizar a presenca."));
    }

    return new Promise<{ enabled: boolean }>((resolve, reject) => {
      this.socket!.emit("gateway:set-rich-presence", presence, (response) => {
        if (response.ok) {
          resolve(response.data ?? { enabled: Boolean(presence) });
          return;
        }

        reject(new Error(`${response.code}: ${response.message}`));
      });
    });
  }

  private handleDispatch(payload: GatewayDispatch) {
    if (!payload || payload.op !== "DISPATCH" || !payload.type) return;
    if (this.isDuplicate(payload)) return;

    this.emit(Events.Raw, payload);

    switch (payload.type) {
      case GatewayEvents.Ready:
        this.handleReady(payload.data as GatewayReadyPayload);
        break;
      case GatewayEvents.MessageCreate:
        emitIf(this, Events.MessageCreate, normalizeMessagePayload(this, payload.data));
        break;
      case GatewayEvents.MessageUpdate:
        this.emit(Events.MessageUpdate, normalizeMessagePayload(this, payload.data) ?? payload.data);
        break;
      case GatewayEvents.MessageDelete:
        this.emit(Events.MessageDelete, payload.data);
        break;
      case GatewayEvents.MessageReactionAdd:
        this.emit(Events.MessageReactionAdd, payload.data);
        break;
      case GatewayEvents.MessageReactionRemove:
        this.emit(Events.MessageReactionRemove, payload.data);
        break;
      case GatewayEvents.GuildCreate:
        this.emit(Events.GuildCreate, normalizeGuild((payload.data as any)?.guild ?? payload.data) ?? payload.data);
        break;
      case GatewayEvents.GuildUpdate:
        this.emit(Events.GuildUpdate, normalizeGuild((payload.data as any)?.guild ?? payload.data) ?? payload.data);
        break;
      case GatewayEvents.GuildDelete:
        this.emit(Events.GuildDelete, payload.data);
        break;
      case GatewayEvents.ChannelCreate:
        this.emit(Events.ChannelCreate, normalizeChannel((payload.data as any)?.channel ?? payload.data) ?? payload.data);
        break;
      case GatewayEvents.ChannelUpdate:
        this.emit(Events.ChannelUpdate, normalizeChannel((payload.data as any)?.channel ?? payload.data) ?? payload.data);
        break;
      case GatewayEvents.ChannelDelete:
        this.emit(Events.ChannelDelete, payload.data);
        break;
      case GatewayEvents.GuildMemberAdd:
        emitIf(this, Events.GuildMemberAdd, normalizeMember(payload.data));
        break;
      case GatewayEvents.GuildMemberUpdate:
        this.emit(Events.GuildMemberUpdate, normalizeMember(payload.data) ?? payload.data);
        break;
      case GatewayEvents.GuildMemberRemove:
        this.emit(Events.GuildMemberRemove, payload.data);
        break;
      case GatewayEvents.UserUpdate:
        this.emit(Events.UserUpdate, normalizeUser((payload.data as any)?.user ?? payload.data));
        break;
      case GatewayEvents.PresenceUpdate:
        this.emit(Events.PresenceUpdate, payload.data);
        break;
      case GatewayEvents.VoiceStateUpdate:
        this.emit(Events.VoiceStateUpdate, payload.data);
        break;
      case GatewayEvents.GuildRoleCreate:
        this.emit(Events.GuildRoleCreate, payload.data);
        break;
      case GatewayEvents.GuildRoleUpdate:
        this.emit(Events.GuildRoleUpdate, payload.data);
        break;
      case GatewayEvents.GuildRoleDelete:
        this.emit(Events.GuildRoleDelete, payload.data);
        break;
      case GatewayEvents.GuildBanAdd:
        this.emit(Events.GuildBanAdd, payload.data);
        break;
      case GatewayEvents.GuildBanRemove:
        this.emit(Events.GuildBanRemove, payload.data);
        break;
      case GatewayEvents.InviteCreate:
        this.emit(Events.InviteCreate, payload.data);
        break;
      case GatewayEvents.InviteDelete:
        this.emit(Events.InviteDelete, payload.data);
        break;
      case GatewayEvents.TypingStart:
        this.emit(Events.TypingStart, payload.data);
        break;
      case GatewayEvents.NotificationCreate:
        this.emit(Events.NotificationCreate, payload.data);
        break;
      default:
        this.emit(Events.Warn, `Evento sem mapper: ${payload.type}`);
    }
  }

  private isDuplicate(payload: GatewayDispatch) {
    if (!payload.eventId) return false;
    if (this.seenEvents.has(payload.eventId)) return true;

    this.seenEvents.set(payload.eventId, Date.now());
    pruneMap(this.seenEvents, this.options.maxSeenEvents);
    return false;
  }

  private startPing() {
    if (this.pingTimer) return;

    this.pingTimer = setInterval(() => {
      const startedAt = Date.now();

      this.socket?.emit("gateway:ping", (response) => {
        if (response.ok) {
          this.ws.ping = Math.max(0, Date.now() - startedAt);
        }
      });
    }, 30_000);
  }
}

function emitIf<K extends keyof EventMap>(
  client: TypecordClient,
  event: K,
  value: EventMap[K][0] | null,
) {
  if (value) {
    (client as unknown as { emit: (event: K, value: EventMap[K][0]) => void }).emit(event, value);
  }
}

function normalizeSendOptions(
  options: string | MessageCreateOptions,
  replyToId?: string | null,
): MessageCreateOptions {
  if (typeof options === "string") {
    return {
      content: options,
      replyToId,
      embeds: [],
    };
  }

  return {
    content: options.content ?? "",
    replyToId: options.replyToId ?? replyToId ?? null,
    embeds: options.embeds ?? [],
  };
}

function serializeMessageOptions(options: MessageCreateOptions) {
  return {
    content: options.content ?? "",
    replyToId: options.replyToId ?? null,
    embeds: (options.embeds ?? []).map((embed) =>
      embed instanceof EmbedBuilder ? embed.toJSON() : embed,
    ),
  };
}

function normalizeMessagePayload(client: TypecordClient, payload: unknown): Message | null {
  const root = asRecord(payload);
  if (!root) return null;

  const rawMessage = asRecord(root.message) ?? root;
  const rawAuthor = asRecord(rawMessage.author) ?? asRecord(rawMessage.member?.user);
  const authorId = rawMessage.authorId ?? rawMessage.userId ?? rawAuthor?.id;
  const guildId = rawMessage.guildId ?? root.guildId ?? rawMessage.channel?.guildId;
  const channelId = rawMessage.channelId ?? root.channelId ?? rawMessage.channel?.id;

  if (!rawMessage.id || !channelId || !authorId || !rawAuthor?.username) {
    return null;
  }

  const parsed = parseStructuredContent(String(rawMessage.content ?? ""));

  return new Message(client, {
    id: String(rawMessage.id),
    content: parsed.content,
    guildId: String(guildId ?? ""),
    channelId: String(channelId),
    author: normalizeUser({
      ...rawAuthor,
      id: authorId,
      bot: rawMessage.isBot ?? rawAuthor.bot,
      verifiedBot: rawMessage.isBotVerified ?? rawAuthor.bot?.verified,
    }),
    authorId: String(authorId),
    isBot: Boolean(rawMessage.isBot ?? rawAuthor.bot),
    isBotVerified: Boolean(rawMessage.isBotVerified ?? rawAuthor.bot?.verified),
    isWebhook: Boolean(rawMessage.isWebhook),
    attachments: parsed.attachments ?? normalizeArray(rawMessage.attachments),
    embeds: parsed.embeds ?? normalizeArray(rawMessage.embeds),
    createdAt:
      typeof rawMessage.createdAt === "string"
        ? rawMessage.createdAt
        : new Date().toISOString(),
    editedAt: rawMessage.editedAt ?? null,
    replyToId: parsed.replyToId ?? rawMessage.replyToId ?? null,
    reply: parsed.reply ?? rawMessage.reply ?? null,
    deleted: Boolean(rawMessage.deleted),
    raw: payload,
  });
}

function parseStructuredContent(content: string): Partial<MessagePayload> & { content: string } {
  const trimmed = content.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return { content };
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!asRecord(parsed)) return { content };

    return {
      content: typeof parsed.content === "string" ? parsed.content : content,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : undefined,
      embeds: Array.isArray(parsed.embeds) ? parsed.embeds : undefined,
      replyToId: typeof parsed.replyToId === "string" ? parsed.replyToId : undefined,
      reply: parsed.reply,
    };
  } catch {
    return { content };
  }
}

function normalizeMember(payload: unknown): GuildMember | null {
  const root = asRecord(payload);
  if (!root) return null;

  const member = asRecord(root.member) ?? root;
  const user = asRecord(member.user) ?? asRecord(root.user) ?? member;
  const userId = user.id ?? member.userId ?? root.userId;
  const guildId = root.guildId ?? member.guildId;

  if (!userId || !guildId || !user.username) return null;

  return {
    id: member.id ? String(member.id) : undefined,
    userId: String(userId),
    guildId: String(guildId),
    user: normalizeUser({ ...user, id: userId }),
    nickname: typeof member.nickname === "string" ? member.nickname : null,
    roles: Array.isArray(member.roles) ? member.roles : [],
    raw: payload,
  };
}

function normalizeUser(raw: RawUser): User {
  const botValue = raw.bot;

  return {
    id: String(raw.id ?? ""),
    username: String(raw.username ?? "unknown"),
    globalName: typeof raw.globalName === "string" ? raw.globalName : null,
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl : null,
    bot: typeof botValue === "boolean" ? botValue : Boolean(botValue),
    verifiedBot: Boolean(raw.verifiedBot ?? raw.isBotVerified ?? raw.bot?.verified),
    raw,
  };
}

function normalizeGuild(raw: unknown): Guild | null {
  const guild = asRecord(raw);
  if (!guild?.id) return null;

  return {
    id: String(guild.id),
    name: String(guild.name ?? "Servidor"),
    iconUrl: typeof guild.iconUrl === "string" ? guild.iconUrl : null,
    raw,
  };
}

function normalizeChannel(raw: unknown): Channel | null {
  const channel = asRecord(raw);
  if (!channel?.id) return null;

  return {
    id: String(channel.id),
    guildId: channel.guildId ? String(channel.guildId) : undefined,
    name: typeof channel.name === "string" ? channel.name : undefined,
    type: typeof channel.type === "string" ? channel.type : undefined,
    raw,
  };
}

function normalizeArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function isSessionUsable(session: GatewaySession | null, marginMs: number) {
  if (!session?.token || !session.expiresAt) return false;

  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > marginMs;
}

function pruneMap(map: Map<string, number>, maximum: number) {
  if (map.size <= maximum) return;

  const removeCount = map.size - Math.floor(maximum * 0.8);
  let removed = 0;

  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= removeCount) break;
  }
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
