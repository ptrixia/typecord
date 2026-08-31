# Typecord

<p align="center">
	<strong>Um espaço de conversa inspirado em comunidades online, construído para aprender, experimentar e evoluir em público.</strong>
</p>

<p align="center">
	<img src="public/typecord-preview.svg" alt="Prévia da interface do Typecord" width="900" />
</p>

<p align="center">
	<a href="#começando">Começar</a> ·
	<a href="#como-colaborar">Colaborar</a> ·
	<a href="#estado-do-projeto">Estado do projeto</a>
</p>

## Sobre o projeto

O **Typecord** é um cliente de comunidades em desenvolvimento, feito com Next.js e React. A ideia é criar uma experiência familiar para quem já usa servidores, canais e mensagens, mas manter o código simples o bastante para ser estudado e melhorado por qualquer pessoa.

O Typecord já possui uma base funcional de produção: autenticação, PostgreSQL via Prisma, Redis, Gateway Socket.IO, mensagens em tempo real, DMs com E2EE, uploads protegidos, moderação, notificações, bots via SDK e cliente desktop Tauri. A plataforma continua em evolução, mas os fluxos principais já estão organizados em camadas executáveis e testáveis.

## Visão rápida

<p align="center">
	<img src="public/typecord-flow.svg" alt="Fluxo técnico do Typecord" width="760" />
</p>

### Recursos disponíveis

- Layout de mensagens com barra superior, canais e lista de membros.
- Navegação lateral para mensagens diretas e guilds.
- Fluxo local para criar uma guild ou simular a entrada por convite.
- Menu do usuário com controles de microfone, áudio e configurações.
- Tema claro e escuro com `next-themes`.
- Seletor de emojis e integração visual com GIFs.
- Componentes reutilizáveis baseados em Base UI, Tailwind CSS e Lucide.
- Mensagens diretas com E2EE por dispositivo, backup criptografado e expiração opcional.
- Busca local em mensagens descriptografadas, sem enviar o texto local ao servidor.
- Favoritos e pastas pessoais para organizar conversas diretas.
- Rich Presence com integração do SDK, bot e cliente Tauri, sem compartilhar o chat atual.
- Sessões ativas, revogação remota, 2FA, logs de segurança e armazenamento nativo de chaves no desktop.
- Bloqueio local por PIN no Tauri, com verificação antes de liberar a interface.
- Denúncias comunitárias com fila administrativa, estados de moderação e auditoria.

### Próximas evoluções

- Expandir o E2EE para verificação visual de dispositivos e rotação assistida de chaves.
- Evoluir o cliente Tauri com tray, atualizações assinadas e integração nativa de notificações.
- Ampliar moderação, discovery, eventos e ferramentas de comunidade.
- Cobrir os fluxos principais com testes de integração e E2E.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Interface | React 19, Next.js 16, TypeScript |
| Estilos | Tailwind CSS 4, shadcn/ui, `tw-animate-css` |
| Componentes | Base UI e Lucide React |
| Conteúdo | React Markdown, remark-gfm e emoji-picker-react |
| Dados planejados | Prisma e PostgreSQL |
| Qualidade | ESLint e TypeScript |

## Começando

### Pré-requisitos

- Node.js 20 ou superior.
- npm 10 ou superior.
- Git.
- PostgreSQL para autenticação, comunidades, mensagens e configurações persistentes.
- Redis em execução na porta padrão `6379`, localmente ou em um serviço hospedado.

### Instalação

```bash
git clone <url-do-repositorio>
cd typecord
npm install
```

Crie um arquivo `.env.local` para as integrações locais. Nunca publique chaves reais no repositório:

```env
NEXT_PUBLIC_GIPHY_API_KEY=sua-chave-do-giphy
DATABASE_URL=postgresql://usuario:senha@localhost:5432/typecord
REDIS_URL=redis://localhost:6379
```

O Typecord usa Redis para recursos em tempo real. Para executar uma instância local com Docker, use:

```bash
docker run --name typecord-redis -p 6379:6379 -d redis:7-alpine
```

Esse comando disponibiliza o Redis em `localhost:6379`, endereço usado por padrão pela aplicação. Se o Redis estiver hospedado em outro endereço, informe a URL correspondente em `REDIS_URL`, por exemplo `redis://usuario:senha@host:6379`.

Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

### Scripts disponíveis

| Comando | Para que serve |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento com atualização automática. |
| `npm run build` | Gera a versão de produção e valida a compilação. |
| `npm run start` | Executa a versão de produção já compilada. |
| `npm run lint` | Verifica problemas de qualidade e estilo no código. |
| `npm run gateway:dev` | Inicia o Gateway Socket.IO em desenvolvimento. |
| `npm run worker:dev` | Inicia os workers de notificações, arquivos e expiração. |
| `npm run tauri:dev` | Executa o cliente desktop Tauri. |
| `npm run tauri:build` | Gera o instalador do cliente desktop. |

### Banco de dados

As alterações de schema são versionadas em `prisma/migrations`. Em um ambiente de
desenvolvimento, aplique-as com:

```bash
npx prisma migrate dev
npx prisma generate
```

Em produção, use o fluxo não destrutivo:

```bash
npx prisma migrate deploy
npx prisma generate
```

As migrações de E2EE, expiração de mensagens, denúncias e organização de DMs
precisam ser aplicadas antes de habilitar esses fluxos em uma instalação nova.

### Gateway e Rich Presence

O Gateway Socket.IO distribui criação, edição, exclusão, reações, presença,
notificações e estados de voz. Bots podem publicar presença sem expor canal ou
conversa:

```ts
await client.setRichPresence({
  type: "PLAYING",
  name: "Typecord",
  details: "Servidor online",
  largeImageUrl: "https://example.com/typecord-isotipo.png",
});
```

O cliente reaplica a presença após reconexão. `clearRichPresence()` remove a
atividade publicada.

## Webhooks

Webhooks permitem publicar uma mensagem em um canal sem abrir a interface do Typecord. A rota aceita requisições `POST` no formato `/api/webhooks/[channelId]`, em que `channelId` é o ID do canal de destino.

### Corpo da requisição

Envie um objeto JSON com os seguintes campos:

| Campo | Obrigatório | Descrição |
| --- | --- | --- |
| `content` | Sim | Texto da mensagem enviada pelo webhook. |
| `botName` | Não | Nome exibido para o bot. O padrão é `Webhook`. |
| `avatarUrl` | Não | URL da imagem exibida como avatar. |

Exemplo usando `fetch`:

```js
fetch("http://localhost:3000/api/webhooks/468ae58e-0d41-4a04-b888-451a8676e8cf", {
	method: "POST",
	headers: {
		"Content-Type": "application/json"
	},
	body: JSON.stringify({
		content: "WEBHOOK_TEST",
		botName: "WEBHOOK_TESTE",
		avatarUrl: ""
	})
})
	.then((res) => res.json())
	.then(console.log);
```

O mesmo envio usando `curl`:

```bash
curl -X POST http://localhost:3000/api/webhooks/468ae58e-0d41-4a04-b888-451a8676e8cf \
	-H "Content-Type: application/json" \
	-d '{"content":"WEBHOOK_TEST","botName":"WEBHOOK_TESTE","avatarUrl":""}'
```

Em caso de sucesso, a API retorna `200` com `success: true` e os dados da mensagem criada:

```json
{
	"success": true,
	"message": {
		"content": "WEBHOOK_TEST",
		"author": "WEBHOOK_TESTE",
		"isWebhook": true
	}
}
```

Se `content` não for enviado, a resposta será `400`. Para um `channelId` inexistente, a resposta será `404`. Outros erros inesperados retornam `500` com uma mensagem no campo `error`.

## Estrutura do projeto

```text
src/
├── app/                    # Entrada do Next.js, layout e estilos globais
├── components/             # Componentes visuais da aplicação
│   ├── DirectMessages/     # Acesso às mensagens diretas
│   ├── Guild/              # Canais, chat, membros e guild layout
│   └── ui/                 # Primitivos reutilizáveis
└── lib/                    # Utilitários compartilhados
prisma/
└── schema.prisma           # Modelo de dados para a evolução do backend
public/                     # Assets públicos e imagens da documentação
```

## Como colaborar

Contribuições são bem-vindas, inclusive pequenas: corrigir um detalhe visual, melhorar acessibilidade, documentar uma decisão ou criar um teste já ajuda o projeto a avançar.

### 1. Prepare seu ambiente

```bash
git checkout -b feat/nome-da-melhoria
npm install
npm run dev
```

Antes de editar, leia os arquivos próximos ao comportamento que deseja mudar. A organização atual separa o shell da aplicação (`Navbar`, `Sidebar` e `GuildLayout`) dos módulos de guild (`ChatArea`, `ChannelsSideBar` e `MembersSidebar`).

### 2. Faça uma mudança pequena

Prefira alterações focadas e compatíveis com os padrões existentes. Para componentes interativos, mantenha o estado perto do componente que controla a interação. Para novos controles, use os componentes e ícones já instalados antes de criar uma solução paralela.

### 3. Valide antes de abrir o pull request

```bash
npm run lint
npm run build
```

Teste também no navegador os estados que você alterou, incluindo tema claro/escuro, tamanhos menores de tela e estados vazios. Se a mudança envolver persistência, inclua a alteração correspondente no schema e explique como reproduzir o cenário localmente.

### 4. Abra o pull request

Descreva o problema, a solução, como testar e inclua uma imagem ou GIF quando a mudança for visual. Um bom título é curto e começa pelo tipo da alteração:

```text
feat: adicionar criação persistente de guild
fix: corrigir menu de usuário no tema escuro
docs: explicar fluxo de desenvolvimento
```

## Boas práticas do projeto

- Mantenha textos da interface em português do Brasil, salvo quando houver uma razão de produto para usar outro idioma.
- Não coloque segredos, chaves de API ou credenciais em commits.
- Preserve acessibilidade: botões precisam de nomes claros, foco visível e estados compreensíveis.
- Não apresente dados mockados como se fossem persistidos; indique claramente quando um fluxo é local.
- Prefira componentes pequenos e legíveis a abstrações prematuras.

## Estado do projeto

O Typecord está em fase de produto funcional em evolução. Antes de um deploy público, configure secrets independentes para NextAuth e realtime, execute todas as migrações Prisma, mantenha PostgreSQL/Redis em rede privada e valide os fluxos de autenticação, E2EE, uploads e voz no ambiente final.

## Licença

Ainda não foi definida uma licença para o projeto. Até que isso aconteça, consulte os responsáveis antes de redistribuir o código ou publicar derivados.

---
