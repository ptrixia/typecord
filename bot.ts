import "dotenv/config";

import {
  EmbedBuilder,
  Events,
  Message,
  TypecordClient,
} from "./SDK/typecord/index.ts";

const client = new TypecordClient({
  apiUrl: process.env.TYPECORD_URL || "http://localhost:3000",
  gatewayUrl:
    process.env.TYPECORD_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_URL ||
    "http://localhost:3001",
  token: process.env.TYPECORD_BOT_TOKEN || process.env.BOT_TOKEN,
});

const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || "";

function displayName(message: Message) {
  return message.author.globalName || message.author.username;
}

client.commands
  .setPrefix("!")
  .register({
    name: "ping",
    description: "Mostra a latencia do gateway.",
    execute: async ({ message, client }) => {
      const latency = Number.isFinite(message.createdTimestamp)
        ? Math.max(0, Date.now() - message.createdTimestamp)
        : client.ws.ping;

      await message.reply(`Pong! ${latency}ms`);
    },
  })
  .register({
    name: "hello",
    aliases: ["oi", "ola"],
    execute: async ({ message }) => {
      await message.reply(`Ola, ${displayName(message)}!`);
    },
  })
  .register({
    name: "say",
    execute: async ({ message, args }) => {
      const text = args.join(" ").trim();
      await message.reply(text || "Use: `!say <texto>`");
    },
  })
  .register({
    name: "userinfo",
    execute: async ({ message }) => {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Informacoes do usuario")
            .setColor("#22C55E")
            .setDescription(
              `Nome: ${message.author.globalName || "Nenhum"}\n` +
                `Username: @${message.author.username}\n` +
                `ID: ${message.author.id}\n` +
                `Bot: ${message.author.bot ? "sim" : "nao"}`,
            ),
        ],
      });
    },
  })
  .register({
    name: "avatar",
    execute: async ({ message }) => {
      if (!message.author.avatarUrl) {
        await message.reply("Este usuario nao possui avatar.");
        return;
      }

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Avatar de @${message.author.username}`)
            .setColor("#EC4899")
            .setImage(message.author.avatarUrl),
        ],
      });
    },
  })
  .register({
    name: "coinflip",
    aliases: ["moeda"],
    execute: async ({ message }) => {
      await message.reply(`A moeda caiu em: **${Math.random() < 0.5 ? "Cara" : "Coroa"}**`);
    },
  })
  .register({
    name: "roll",
    aliases: ["dado"],
    execute: async ({ message, args }) => {
      const parsed = Number.parseInt(args[0] ?? "6", 10);
      const sides =
        Number.isSafeInteger(parsed) && parsed >= 2 && parsed <= 1_000_000 ? parsed : 6;
      const result = Math.floor(Math.random() * sides) + 1;

      await message.reply(`Voce rolou d${sides}: **${result}**`);
    },
  })
  .register({
    name: "embed",
    execute: async ({ message }) => {
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Embed de teste")
            .setDescription("Mensagem enviada usando a Typecord SDK.")
            .setColor("#5865F2")
            .addFields(
              { name: "Guild", value: message.guildId || "desconhecida", inline: true },
              { name: "Canal", value: message.channelId, inline: true },
            )
            .setFooter({ text: "Typecord Bot" })
            .setTimestamp(),
        ],
      });
    },
  })
  .register({
    name: "editme",
    execute: async ({ message, args, client }) => {
      const text = args.join(" ").trim() || "mensagem editada pela SDK";
      const sent = await client.channels.send(message.channelId, "Mensagem criada. Editando...");

      if (sent instanceof Message) {
        await sent.edit(text);
      }
    },
  })
  .register({
    name: "delete-me",
    execute: async ({ message, client }) => {
      const sent = await client.channels.send(
        message.channelId,
        "Esta mensagem sera apagada em 2 segundos.",
      );

      if (sent instanceof Message) {
        setTimeout(() => {
          void sent.delete().catch((error) => {
            console.error("[bot] Falha ao apagar mensagem:", error);
          });
        }, 2_000).unref?.();
      }
    },
  })
  .register({
    name: "help",
    execute: async ({ message, client }) => {
      const commands = client.commands
        .list()
        .map((command) => `**!${command.name}**${command.description ? ` - ${command.description}` : ""}`)
        .join("\n");

      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Typecord Bot")
            .setColor("#5865F2")
            .setDescription(commands || "Nenhum comando registrado."),
        ],
      });
    },
  });

client.once(Events.ClientReady, (ready) => {
  console.log(`Typecord bot online como @${ready.user.username}`);
  console.log(`Guilds: ${ready.guilds.size}`);
  void client
    .setRichPresence({
      type: "PLAYING",
      name: "Typecord",
      details: "Servidor online",
      state: "Ajudando a comunidade",
      largeImageUrl: `${process.env.TYPECORD_URL || "http://localhost:3000"}/typecord-isotipo.png`,
      largeImageText: "Typecord",
    })
    .then(() => console.log("Rich Presence do bot ativado."))
    .catch((error) => console.error("[bot] Falha ao ativar Rich Presence:", error));
  console.log("Use !help no chat.");
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  console.log(
    `[message] guild=${message.guildId} channel=${message.channelId} author=@${message.author.username} content="${message.content}"`,
  );

  await client.commands.handle(message);
});

client.on(Events.GuildMemberAdd, async (member) => {
  if (!welcomeChannelId) {
    return;
  }

  await client.channels.send(welcomeChannelId, {
    embeds: [
      new EmbedBuilder()
        .setTitle("Novo membro")
        .setDescription(`Seja bem-vindo(a), **${member.user.globalName || member.user.username}**!`)
        .setColor("#5865F2")
        .setTimestamp(),
    ],
  });
});

client.on(Events.Raw, (payload) => {
  if (payload.type !== "MESSAGE_CREATE" && payload.type !== "TYPING_START") {
    console.log(`[event] ${payload.type}`);
  }
});

client.on(Events.Error, (error) => {
  console.error("[typecord:error]", error);
});

client.on(Events.Disconnect, (reason) => {
  console.warn(`[typecord:disconnect] ${reason}`);
});

process.on("SIGINT", () => {
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});

try {
  await client.login();
} catch (error) {
  console.error("[typecord:login]", error instanceof Error ? error.message : error);
  process.exit(1);
}
