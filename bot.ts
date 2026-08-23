import "dotenv/config";
import Pusher from "pusher-js";

const TYPECORD_URL = "http://localhost:3000";
const BOT_TOKEN = "tc_bot_pbxJ6Ab3lbwEPt18LknTHgKU8XGnCdVGjscHy3PUhXjhqf4dL0cfKkpQPn6gpKX0";

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

interface GatewayResponse {
    url: string;
    session: {
        id: string;
        token: string;
        expiresAt: string;
    };
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
    pusher: {
        key: string;
        cluster: string;
        authEndpoint: string;
        channel: string;
    };
}

interface GatewayPayload<T = unknown> {
    op: number;
    t: string;
    s: number;
    d: T;
}

interface ReadyData {
    user: {
        id: string;
        bot: boolean;
    };
    guilds: {
        id: string;
        name: string;
        iconUrl: string | null;
    }[];
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
    isWebhook?: boolean;
    attachments?: {
        id: string;
        url: string;
        filename: string;
        fileSize: number;
        fileType: string;
    }[];
    embeds?: BotEmbed[];
    createdAt: string;
    replyToId: string | null;
    reply?: unknown;
}

interface RawMessageData {
    content?: unknown;
    reply?: unknown;
    replyToId?: unknown;
    attachments?: unknown;
    embeds?: unknown;
}

let pusher: Pusher | null = null;
let currentSession: GatewayResponse["session"] | null = null;
let currentBotUserId: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

function normalizeMessage(message: MessageCreateData): MessageCreateData {
    if (typeof message.content !== "string") {
        return message;
    }

    const rawContent = message.content.trim();

    if (!rawContent.startsWith("{") || !rawContent.endsWith("}")) {
        return message;
    }

    try {
        const parsed = JSON.parse(rawContent) as RawMessageData;

        if (!parsed || typeof parsed !== "object") {
            return message;
        }

        const nestedContent = typeof parsed.content === "string" ? parsed.content : message.content;
        const nestedEmbeds = Array.isArray(parsed.embeds) ? parsed.embeds as BotEmbed[] : message.embeds ?? [];
        const nestedAttachments = Array.isArray(parsed.attachments) ? parsed.attachments as MessageCreateData["attachments"] : message.attachments ?? [];
        const nestedReply = typeof parsed.replyToId === "string" ? parsed.replyToId : message.replyToId;

        return {
            ...message,
            content: nestedContent,
            embeds: nestedEmbeds,
            attachments: nestedAttachments,
            replyToId: nestedReply,
            reply: parsed.reply ?? message.reply,
        };
    } catch {
        return message;
    }
}

async function createGatewaySession(): Promise<GatewayResponse> {
    console.log("");
    console.log("🔐 Autenticando bot...");

    const response = await fetch(`${TYPECORD_URL}/api/gateway`, {
        method: "GET",
        headers: {
            Authorization: `Bot ${BOT_TOKEN}`,
            Accept: "application/json",
        },
    });

    const body = await response.text();
    console.log(`📡 Gateway respondeu: ${response.status}`);

    if (!response.ok) {
        throw new Error(`Gateway recusou o bot (${response.status}): ${body}`);
    }

    let data: GatewayResponse;

    try {
        data = JSON.parse(body) as GatewayResponse;
    } catch {
        throw new Error(`Resposta inválida do Gateway: ${body.slice(0, 1000)}`);
    }

    if (!data.session || !data.session.token) {
        throw new Error("Gateway não retornou uma sessão válida.");
    }

    if (!data.bot || !data.bot.user) {
        throw new Error("Gateway não retornou os dados do bot.");
    }

    currentSession = data.session;
    currentBotUserId = data.bot.user.id;

    console.log(`🤖 Bot autenticado como @${data.bot.user.username}`);
    console.log(`🆔 User ID: ${data.bot.user.id}`);
    console.log(`🏠 Guilds: ${data.guilds?.length ?? 0}`);

    return data;
}

async function sendMessage(channelId: string, content = "", replyToId?: string, embed?: BotEmbed) {
    const payload: { content: string; replyToId?: string; embeds?: BotEmbed[] } = { content };

    if (replyToId) {
        payload.replyToId = replyToId;
    }

    if (embed) {
        payload.embeds = [embed];
    }

    const response = await fetch(`${TYPECORD_URL}/api/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${BOT_TOKEN}`,
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    const body = await response.text();
    console.log(`📡 API respondeu: HTTP ${response.status}`);

    if (!response.ok) {
        console.error("❌ Resposta:", body);
        throw new Error(`Falha ao enviar mensagem (${response.status}): ${body}`);
    }

    let result: unknown = null;

    if (body) {
        try {
            result = JSON.parse(body);
        } catch {
            result = body;
        }
    }

    console.log("✅ Mensagem enviada com sucesso!");
    return result;
}

function logMessage(originalMessage: MessageCreateData) {
    const message = normalizeMessage(originalMessage);
    const date = new Date(message.createdAt);

    console.log("");
    console.log("╔══════════════════════════════════════╗");
    console.log("║ 💬 NOVA MENSAGEM");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║ 👤 Usuário: ${message.author.globalName ?? message.author.username}`);
    console.log(`║ 🏷️ Username: @${message.author.username}`);
    console.log(`║ 🆔 User ID: ${message.author.id}`);
    console.log(`║ 🤖 Bot: ${message.isBot ? "sim" : "não"}`);
    console.log(`║ 🏠 Guild ID: ${message.guildId}`);
    console.log(`║ 💬 Channel ID: ${message.channelId}`);
    console.log(`║ 🕐 Data: ${date.toLocaleString("pt-BR")}`);
    console.log(`║ 📝 Mensagem: ${message.content}`);
    console.log(`║ 🖼️ Embeds: ${message.embeds?.length ?? 0}`);
    console.log(`║ 📎 Anexos: ${message.attachments?.length ?? 0}`);
    console.log("╚══════════════════════════════════════╝");
    console.log("");
}

async function handleMessage(originalMessage: MessageCreateData) {
    const message = normalizeMessage(originalMessage);

    if (message.author.id === currentBotUserId) {
        console.log("↩️ Ignorando mensagem enviada pelo próprio bot.");
        return;
    }

    logMessage(message);

    const rawContent = message.content.trim();
    if (!rawContent.startsWith("!")) return;

    const args = rawContent.split(/\s+/);
    const command = args.shift()?.toLowerCase();

    if (command === "!ping") {
        const ping = Math.abs(Date.now() - new Date(message.createdAt).getTime());
        await sendMessage(message.channelId, `Pong! 🏓 **${ping}ms**`, message.id);
        return;
    }

    if (command === "!help") {
        await sendMessage(message.channelId, "", message.id, {
            title: "📚 Lista de Comandos",
            color: "#5865F2",
            description: "**!ping** - Verifica a latência do bot.\n**!hello** - O bot diz olá para você.\n**!say <texto>** - Faz o bot repetir o que você escreveu.\n**!userinfo** - Mostra suas informações.\n**!avatar** - Mostra o seu avatar.\n**!coinflip** - Joga uma moeda.\n**!roll [lados]** - Rola um dado.\n**!embed** - Envia um embed de teste.",
        });
        return;
    }

    if (command === "!say") {
        const text = args.join(" ");
        if (!text) {
            await sendMessage(message.channelId, "Você precisa me dizer o que repetir! Use: `!say <texto>`", message.id);
            return;
        }
        await sendMessage(message.channelId, text);
        return;
    }

    if (command === "!userinfo") {
        const avatarMarkdown = message.author.avatarUrl ? `\n\n![Avatar](${message.author.avatarUrl})` : "";
        
        await sendMessage(message.channelId, "", message.id, {
            title: "👤 Informações do Usuário",
            color: "#00FF00",
            description: `**Nome Global:** ${message.author.globalName || "Nenhum"}\n**Username:** @${message.author.username}\n**ID:** ${message.author.id}${avatarMarkdown}`,
        });
        return;
    }

    if (command === "!avatar") {
        if (!message.author.avatarUrl) {
            await sendMessage(message.channelId, "Você não possui um avatar!", message.id);
            return;
        }
        
        await sendMessage(message.channelId, "", message.id, {
            title: `Avatar de @${message.author.username}`,
            color: "#FF00FF",
            description: `![Avatar](${message.author.avatarUrl})`
        });
        return;
    }

    if (command === "!coinflip") {
        const result = Math.random() < 0.5 ? "Cara 🪙" : "Coroa 🪙";
        await sendMessage(message.channelId, `A moeda caiu em: **${result}**`, message.id);
        return;
    }

    if (command === "!roll") {
        let sides = 6;
        if (args.length > 0 && !isNaN(parseInt(args[0]))) {
            sides = parseInt(args[0]);
        }
        
        if (sides < 2) sides = 6;
        
        const result = Math.floor(Math.random() * sides) + 1;
        await sendMessage(message.channelId, `🎲 Você rolou um dado de ${sides} lados e tirou: **${result}**`, message.id);
        return;
    }

    if (command === "!hello") {
        const name = message.author.globalName ?? message.author.username;
        await sendMessage(message.channelId, `Olá, ${name}! 👋`, message.id);
        return;
    }

    if (command === "!embed") {
        await sendMessage(message.channelId, "", message.id, {
            title: "🤖 Typecord Bot",
            description: "Este embed foi enviado diretamente pela API do bot.\n\n**Status:** Online 🟢\n**Plataforma:** Typecord",
            color: "#5865F2",
            footer: { text: "Typecord • Bot" },
        });
        return;
    }

    console.log("ℹ️ Nenhum comando reconhecido ou prefixo inválido.");
}

async function connect() {
    if (shuttingDown) {
        return;
    }

    if (pusher) {
        try {
            pusher.disconnect();
        } catch {}
    }

    pusher = null;
    const gateway = await createGatewaySession();
    const authEndpoint = gateway.pusher.authEndpoint.startsWith("http")
        ? gateway.pusher.authEndpoint
        : `${TYPECORD_URL}${gateway.pusher.authEndpoint}`;

    const client = new Pusher(gateway.pusher.key, {
        cluster: gateway.pusher.cluster,
        forceTLS: true,
        authEndpoint,
        auth: {
            headers: {
                Authorization: `Bearer ${gateway.session.token}`,
            },
        },
    });

    pusher = client;

    client.connection.bind("connecting", () => {
        console.log("🟡 Conectando ao Pusher...");
    });

    client.connection.bind("connected", () => {
        console.log("🟢 Pusher conectado!");
    });

    client.connection.bind("disconnected", () => {
        console.log("🔴 Pusher desconectado.");
        scheduleReconnect();
    });

    client.connection.bind("error", (error: unknown) => {
        console.error("❌ Erro do Pusher:", error);
    });

    const channel = client.subscribe(gateway.pusher.channel);

    channel.bind("pusher:subscription_succeeded", () => {
        console.log("🔐 Canal do bot autenticado.");
    });

    channel.bind("pusher:subscription_error", (error: unknown) => {
        console.error("❌ Erro na autenticação do canal:", error);
    });

    channel.bind("READY", (payload: GatewayPayload<ReadyData>) => {
        console.log("");
        console.log("🤖 ========================================");
        console.log("🤖 TYPECORD BOT ONLINE");
        console.log("🤖 ========================================");
        console.log(`🆔 User ID: ${payload.d.user.id}`);
        console.log(`🏠 Guilds: ${payload.d.guilds.length}`);
        console.log("");
        console.log("💡 Comandos carregados. Use !help no chat.");
        console.log("");
    });

    channel.bind("MESSAGE_CREATE", async (payload: GatewayPayload<MessageCreateData>) => {
        console.log("📨 Evento MESSAGE_CREATE recebido!");
        try {
            await handleMessage(payload.d);
        } catch (error) {
            console.error("❌ Erro processando MESSAGE_CREATE:", error);
        }
    });

    console.log("👂 Aguardando eventos...");
}

function scheduleReconnect() {
    if (shuttingDown) {
        return;
    }

    if (reconnectTimer) {
        return;
    }

    console.log("🔄 Reconectando em 5 segundos...");

    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        try {
            await connect();
        } catch (error) {
            console.error("❌ Falha ao reconectar:", error);
            scheduleReconnect();
        }
    }, 5000);
}

async function start() {
    console.log("");
    console.log("================================");
    console.log("       TYPECORD BOT");
    console.log("================================");
    console.log("");

    try {
        await connect();
    } catch (error) {
        console.error("❌ Não foi possível iniciar o bot:", error);
        scheduleReconnect();
    }
}

function shutdown() {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    console.log("🛑 Desligando bot...");

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (pusher) {
        try {
            pusher.disconnect();
        } catch {}
    }

    pusher = null;
    currentSession = null;
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await start();