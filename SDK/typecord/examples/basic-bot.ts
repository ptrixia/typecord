import "dotenv/config";

import {
  EmbedBuilder,
  Events,
  TypecordClient,
} from "../index.ts";

const client = new TypecordClient({
  apiUrl: process.env.TYPECORD_URL,
  gatewayUrl: process.env.TYPECORD_GATEWAY_URL,
  token: process.env.TYPECORD_BOT_TOKEN || process.env.BOT_TOKEN,
});

client.commands.setPrefix("!");

client.commands.register({
  name: "ping",
  description: "Mostra a latencia do gateway.",
  execute: async ({ message, client }) => {
    await message.reply(`Pong! ${client.ws.ping}ms`);
  },
});

client.commands.register({
  name: "embed",
  execute: async ({ message }) => {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Typecord SDK")
          .setDescription("Bot criado com client.on e command router.")
          .setColor("#5865F2")
          .setTimestamp(),
      ],
    });
  },
});

client.once(Events.ClientReady, (ready) => {
  console.log(`Online como @${ready.user.username}`);
  void client.setRichPresence({
    type: "PLAYING",
    name: "Typecord",
    details: "Servidor online",
    largeImageUrl: "https://seu-dominio.com/typecord-isotipo.png",
    largeImageText: "Typecord",
  });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  await client.commands.handle(message);
});

client.on(Events.Raw, (payload) => {
  console.log(`Evento recebido: ${payload.type}`);
});

await client.login();
