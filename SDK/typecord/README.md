# @prixia/sdk

SDK oficial para criar bots e integracoes do Typecord com uma API parecida com Discord.js.

O pacote e independente do backend: ele usa apenas HTTP e o Gateway Socket.IO do Typecord.

## Instalacao

```bash
npm install @prixia/sdk
```

## Exemplo

```ts
import "dotenv/config";
import { EmbedBuilder, Events, TypecordClient } from "@prixia/sdk";

const client = new TypecordClient({
  apiUrl: process.env.TYPECORD_URL || "http://localhost:3000",
  gatewayUrl: process.env.TYPECORD_GATEWAY_URL || "http://localhost:3001",
  token: process.env.TYPECORD_BOT_TOKEN,
});

client.once(Events.ClientReady, (ready) => {
  console.log(`Online como @${ready.user.username}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    await message.reply(`Pong! ${client.ws.ping}ms`);
  }

  if (message.content === "!embed") {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("Typecord")
          .setDescription("Embed enviado pela SDK")
          .setColor("#5865F2")
          .setTimestamp(),
      ],
    });
  }
});

await client.login();
```

## Command router

```ts
client.commands
  .setPrefix("!")
  .register({
    name: "ping",
    description: "Mostra a latencia do gateway.",
    execute: async ({ message, client }) => {
      await message.reply(`Pong! ${client.ws.ping}ms`);
    },
  });

client.on(Events.MessageCreate, (message) => {
  void client.commands.handle(message);
});
```

## Eventos

Use `client.on(Events.Raw, ...)` para receber todos os eventos crus do Gateway.

Eventos amigaveis principais:

- `Events.ClientReady`
- `Events.MessageCreate`
- `Events.MessageUpdate`
- `Events.MessageDelete`
- `Events.MessageReactionAdd`
- `Events.MessageReactionRemove`
- `Events.GuildCreate`
- `Events.GuildUpdate`
- `Events.GuildDelete`
- `Events.GuildMemberAdd`
- `Events.GuildMemberUpdate`
- `Events.GuildMemberRemove`
- `Events.GuildRoleCreate`
- `Events.GuildRoleUpdate`
- `Events.GuildRoleDelete`
- `Events.GuildBanAdd`
- `Events.GuildBanRemove`
- `Events.ChannelCreate`
- `Events.ChannelUpdate`
- `Events.ChannelDelete`
- `Events.InviteCreate`
- `Events.InviteDelete`
- `Events.PresenceUpdate`
- `Events.UserUpdate`
- `Events.TypingStart`
- `Events.NotificationCreate`
- `Events.VoiceStateUpdate`

## Variaveis comuns

```env
TYPECORD_URL=http://localhost:3000
TYPECORD_GATEWAY_URL=http://localhost:3001
TYPECORD_BOT_TOKEN=tc_bot_...
```

## Publicacao

```bash
npm run build
npm publish --access public
```
