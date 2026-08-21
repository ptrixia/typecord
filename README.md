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

Neste momento, a aplicação funciona como um protótipo de interface: já é possível navegar pela estrutura visual, alternar o tema, abrir o fluxo de criação ou entrada em uma guild e interagir com controles locais. O modelo de dados em Prisma já descreve usuários, guilds, cargos, canais, mensagens, anexos, reações e convites para a próxima etapa do produto.

## Visão rápida

<p align="center">
	<img src="public/typecord-flow.svg" alt="Fluxo técnico do Typecord" width="760" />
</p>

### O que já está no protótipo

- Layout de mensagens com barra superior, canais e lista de membros.
- Navegação lateral para mensagens diretas e guilds.
- Fluxo local para criar uma guild ou simular a entrada por convite.
- Menu do usuário com controles de microfone, áudio e configurações.
- Tema claro e escuro com `next-themes`.
- Seletor de emojis e integração visual com GIFs.
- Componentes reutilizáveis baseados em Base UI, Tailwind CSS e Lucide.

### O que vem pela frente

- Persistir autenticação, guilds, canais e mensagens no PostgreSQL.
- Conectar a aplicação ao schema Prisma e criar rotas de servidor.
- Adicionar mensagens em tempo real e presença dos membros.
- Implementar permissões, convites reais, uploads e moderação.
- Cobrir os fluxos principais com testes automatizados.

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
- PostgreSQL apenas quando a camada de persistência começar a ser usada.

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
```

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

O Typecord está em fase de protótipo funcional de frontend. As interações atuais são locais e podem ser reiniciadas ao recarregar a página. O schema Prisma serve como contrato inicial para o backend, mas a aplicação ainda precisa de autenticação, conexão com banco e uma camada de API para se tornar um produto completo.

## Licença

Ainda não foi definida uma licença para o projeto. Até que isso aconteça, consulte os responsáveis antes de redistribuir o código ou publicar derivados.

---