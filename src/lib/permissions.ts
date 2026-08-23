/**
 * Sistema central de permissões do Typecord.
 *
 * IMPORTANTE:
 * As permissões são armazenadas como BIGINT/string no PostgreSQL.
 * Nunca use Number para manipular o bitfield completo.
 */

export const Permissions = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  VIEW_GUILD_INSIGHTS: 1n << 19n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EXPRESSIONS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
  VIEW_CREATOR_MONETIZATION_ANALYTICS: 1n << 41n,
  USE_SOUNDBOARD: 1n << 42n,
  CREATE_GUILD_EXPRESSIONS: 1n << 43n,
  CREATE_EVENTS: 1n << 44n,
  USE_EXTERNAL_SOUNDS: 1n << 45n,
  SEND_VOICE_MESSAGES: 1n << 46n,

  // 47 e 48 são mantidos livres para compatibilidade futura.
  SEND_POLLS: 1n << 49n,
  USE_EXTERNAL_APPS: 1n << 50n,
  PIN_MESSAGES: 1n << 51n,
  BYPASS_SLOWMODE: 1n << 52n,
} as const;

export type PermissionName = keyof typeof Permissions;

/**
 * Todas as permissões disponíveis.
 */
export const ALL_PERMISSIONS = Object.values(Permissions).reduce(
  (all, permission) => all | permission,
  0n,
);

/**
 * Converte qualquer valor de permissões para bigint com segurança.
 *
 * PostgreSQL/Prisma normalmente retorna BIGINT como bigint,
 * mas algumas partes da aplicação podem fornecer string.
 */
export function normalizePermissions(
  value: string | bigint | number | null | undefined,
): bigint {
  if (value === null || value === undefined) {
    return 0n;
  }

  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Verifica se um bitfield possui determinada permissão.
 *
 * ADMINISTRATOR possui todas as permissões.
 */
export function hasPermission(
  bitfield: string | bigint | number | null | undefined,
  permission: bigint,
): boolean {
  const bits = normalizePermissions(bitfield);

  if ((bits & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }

  return (bits & permission) === permission;
}

/**
 * Verifica se o bitfield possui TODAS as permissões informadas.
 */
export function hasAllPermissions(
  bitfield: string | bigint | number | null | undefined,
  permissions: readonly bigint[],
): boolean {
  const bits = normalizePermissions(bitfield);

  if ((bits & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }

  return permissions.every(
    (permission) => (bits & permission) === permission,
  );
}

/**
 * Verifica se o bitfield possui PELO MENOS UMA das permissões.
 */
export function hasAnyPermission(
  bitfield: string | bigint | number | null | undefined,
  permissions: readonly bigint[],
): boolean {
  const bits = normalizePermissions(bitfield);

  if ((bits & Permissions.ADMINISTRATOR) !== 0n) {
    return true;
  }

  return permissions.some(
    (permission) => (bits & permission) === permission,
  );
}

/**
 * Adiciona uma permissão ao bitfield.
 */
export function addPermission(
  bitfield: string | bigint | number | null | undefined,
  permission: bigint,
): string {
  return (
    normalizePermissions(bitfield) |
    permission
  ).toString();
}

/**
 * Remove uma permissão do bitfield.
 */
export function removePermission(
  bitfield: string | bigint | number | null | undefined,
  permission: bigint,
): string {
  return (
    normalizePermissions(bitfield) &
    ~permission
  ).toString();
}

/**
 * Alterna uma permissão.
 */
export function togglePermission(
  bitfield: string | bigint | number | null | undefined,
  permission: bigint,
  enabled: boolean,
): string {
  return enabled
    ? addPermission(bitfield, permission)
    : removePermission(bitfield, permission);
}

/**
 * Retorna os nomes das permissões presentes no bitfield.
 */
export function getPermissionNames(
  bitfield: string | bigint | number | null | undefined,
): PermissionName[] {
  const bits = normalizePermissions(bitfield);

  return (
    Object.entries(Permissions) as [
      PermissionName,
      (typeof Permissions)[PermissionName],
    ][]
  )
    .filter(([, permission]) => (bits & permission) === permission)
    .map(([name]) => name);
}

/**
 * Retorna um bitfield sem permissões desconhecidas.
 */
export function sanitizePermissions(
  bitfield: string | bigint | number | null | undefined,
): bigint {
  return normalizePermissions(bitfield) & ALL_PERMISSIONS;
}

/**
 * Retorna se o bitfield representa Administrador.
 */
export function isAdministrator(
  bitfield: string | bigint | number | null | undefined,
): boolean {
  return (
    normalizePermissions(bitfield) &
    Permissions.ADMINISTRATOR
  ) !== 0n;
}

/**
 * Labels exibidos na interface.
 */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  CREATE_INSTANT_INVITE: "Criar convite",
  KICK_MEMBERS: "Expulsar membros",
  BAN_MEMBERS: "Banir membros",
  ADMINISTRATOR: "Administrador",

  MANAGE_CHANNELS: "Gerenciar canais",
  MANAGE_GUILD: "Gerenciar servidor",

  ADD_REACTIONS: "Adicionar reações",
  VIEW_AUDIT_LOG: "Ver registro de auditoria",
  PRIORITY_SPEAKER: "Prioridade de fala",
  STREAM: "Vídeo",

  VIEW_CHANNEL: "Ver canais",
  SEND_MESSAGES: "Enviar mensagens",
  SEND_TTS_MESSAGES: "Enviar mensagens TTS",

  MANAGE_MESSAGES: "Gerenciar mensagens",
  EMBED_LINKS: "Incorporar links",
  ATTACH_FILES: "Anexar arquivos",
  READ_MESSAGE_HISTORY: "Ler histórico de mensagens",

  MENTION_EVERYONE: "Mencionar @everyone, @here e todos os cargos",
  USE_EXTERNAL_EMOJIS: "Usar emojis externos",
  VIEW_GUILD_INSIGHTS: "Ver análises do servidor",

  CONNECT: "Conectar",
  SPEAK: "Falar",
  MUTE_MEMBERS: "Silenciar membros",
  DEAFEN_MEMBERS: "Ensurdecer membros",
  MOVE_MEMBERS: "Mover membros",
  USE_VAD: "Usar detecção de voz",

  CHANGE_NICKNAME: "Alterar apelido",
  MANAGE_NICKNAMES: "Gerenciar apelidos",
  MANAGE_ROLES: "Gerenciar cargos",
  MANAGE_WEBHOOKS: "Gerenciar webhooks",

  MANAGE_EXPRESSIONS: "Gerenciar expressões",
  USE_APPLICATION_COMMANDS: "Usar comandos de aplicativos",

  REQUEST_TO_SPEAK: "Solicitar para falar",

  MANAGE_EVENTS: "Gerenciar eventos",
  MANAGE_THREADS: "Gerenciar threads",
  CREATE_PUBLIC_THREADS: "Criar threads públicas",
  CREATE_PRIVATE_THREADS: "Criar threads privadas",

  USE_EXTERNAL_STICKERS: "Usar figurinhas externas",
  SEND_MESSAGES_IN_THREADS: "Enviar mensagens em threads",

  USE_EMBEDDED_ACTIVITIES: "Usar atividades",

  MODERATE_MEMBERS: "Moderar membros",

  VIEW_CREATOR_MONETIZATION_ANALYTICS:
    "Ver análises de monetização",

  USE_SOUNDBOARD: "Usar Soundboard",
  CREATE_GUILD_EXPRESSIONS: "Criar expressões",
  CREATE_EVENTS: "Criar eventos",

  USE_EXTERNAL_SOUNDS: "Usar sons externos",
  SEND_VOICE_MESSAGES: "Enviar mensagens de voz",

  SEND_POLLS: "Enviar enquetes",
  USE_EXTERNAL_APPS: "Usar aplicativos externos",

  PIN_MESSAGES: "Fixar mensagens",
  BYPASS_SLOWMODE: "Ignorar slowmode",
};