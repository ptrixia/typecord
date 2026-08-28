"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AtSign,
  Ban,
  Blocks,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Copy,
  Crown,
  FileClock,
  FolderPlus,
  Gauge,
  Hash,
  ImagePlus,
  KeyRound,
  Link,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Trash2,
  UserCog,
  UserMinus,
  Users,
  Volume2,
  X,
} from "lucide-react";

import { createChannel } from "@/actions/channels";
import {
  createRole,
  deleteRole,
  updateRole,
} from "@/actions/roles";
import { toggleMemberRole } from "@/actions/members";
import {
  banGuildMember,
  createAutoModRule,
  createGuildCategory,
  createGuildEmoji,
  createGuildSticker,
  createModerationWarning,
  createScheduledEvent,
  createServerTemplate,
  createSoundboardSound,
  deleteGuildCategory,
  deleteGuildEmoji,
  deleteGuildPermanently,
  getGuildSettingsExtras,
  kickGuildMember,
  leaveGuild,
  renameGuildCategory,
  transferGuildOwnership,
  timeoutGuildMember,
  toggleAutoModRule,
  updateScheduledEventStatus,
  unbanGuildMember,
  updateGuildOnboarding,
  updateDefaultRolePermissions,
  updateGuildMemberNickname,
  updateGuildProfile,
} from "@/actions/guild-settings";
import {
  PERMISSION_LABELS,
  Permissions,
  type PermissionName,
} from "@/lib/permissions";

import InvitesSettings from "./InviteSettings";
import Avatar from "../Image/Avatar";
import Banner from "../Image/Banner";

type Tab =
  | "overview"
  | "roles"
  | "members"
  | "channels"
  | "invites"
  | "emojis"
  | "bans"
  | "audit"
  | "production"
  | "advanced";

type RoleDraft = {
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
};

type Extras = Awaited<ReturnType<typeof getGuildSettingsExtras>>;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  guild: any;
};

type Notice = {
  type: "success" | "error";
  text: string;
};

type ConfirmState =
  | {
      type: "kick" | "ban";
      member: any;
    }
  | {
      type: "delete-role";
      role: any;
    }
  | {
      type: "delete-category";
      category: any;
    }
  | {
      type: "delete-emoji";
      emoji: any;
    }
  | null;

const permissionGroups: {
  title: string;
  description: string;
  permissions: PermissionName[];
}[] = [
  {
    title: "Geral do servidor",
    description: "Administração, informações e recursos gerais do servidor.",
    permissions: [
      "ADMINISTRATOR",
      "MANAGE_GUILD",
      "VIEW_AUDIT_LOG",
      "CREATE_INSTANT_INVITE",
      "MANAGE_EVENTS",
      "CREATE_EVENTS",
    ],
  },
  {
    title: "Membros e moderação",
    description: "Controle de membros, apelidos e ações de moderação.",
    permissions: [
      "KICK_MEMBERS",
      "BAN_MEMBERS",
      "MODERATE_MEMBERS",
      "CHANGE_NICKNAME",
      "MANAGE_NICKNAMES",
      "MOVE_MEMBERS",
      "MUTE_MEMBERS",
      "DEAFEN_MEMBERS",
    ],
  },
  {
    title: "Cargos",
    description: "Gerenciamento da hierarquia e dos cargos do servidor.",
    permissions: ["MANAGE_ROLES"],
  },
  {
    title: "Canais",
    description: "Controle da estrutura, visualização e organização de canais.",
    permissions: ["MANAGE_CHANNELS", "VIEW_CHANNEL"],
  },
  {
    title: "Mensagens",
    description: "Envio, histórico, anexos, reações e moderação de mensagens.",
    permissions: [
      "SEND_MESSAGES",
      "SEND_MESSAGES_IN_THREADS",
      "READ_MESSAGE_HISTORY",
      "MANAGE_MESSAGES",
      "EMBED_LINKS",
      "ATTACH_FILES",
      "ADD_REACTIONS",
      "MENTION_EVERYONE",
      "SEND_TTS_MESSAGES",
      "PIN_MESSAGES",
      "SEND_POLLS",
      "BYPASS_SLOWMODE",
    ],
  },
  {
    title: "Threads",
    description: "Criação e gerenciamento de conversas em threads.",
    permissions: [
      "MANAGE_THREADS",
      "CREATE_PUBLIC_THREADS",
      "CREATE_PRIVATE_THREADS",
    ],
  },
  {
    title: "Expressões",
    description: "Emojis, figurinhas e expressões externas.",
    permissions: [
      "MANAGE_EXPRESSIONS",
      "CREATE_GUILD_EXPRESSIONS",
      "USE_EXTERNAL_EMOJIS",
      "USE_EXTERNAL_STICKERS",
    ],
  },
  {
    title: "Voz e vídeo",
    description: "Conexão, fala, vídeo, transmissão e recursos de áudio.",
    permissions: [
      "CONNECT",
      "SPEAK",
      "STREAM",
      "USE_VAD",
      "PRIORITY_SPEAKER",
      "REQUEST_TO_SPEAK",
      "USE_SOUNDBOARD",
      "USE_EXTERNAL_SOUNDS",
      "SEND_VOICE_MESSAGES",
    ],
  },
  {
    title: "Aplicativos",
    description: "Comandos, atividades incorporadas e integrações externas.",
    permissions: [
      "USE_APPLICATION_COMMANDS",
      "USE_EMBEDDED_ACTIVITIES",
      "USE_EXTERNAL_APPS",
    ],
  },
];

const auditLabels: Record<string, string> = {
  GUILD_UPDATE: "Servidor atualizado",
  GUILD_OWNERSHIP_TRANSFER: "Propriedade transferida",
  ROLE_CREATE: "Cargo criado",
  ROLE_UPDATE: "Cargo atualizado",
  ROLE_DELETE: "Cargo excluído",
  MEMBER_ROLE_ADD: "Cargo atribuído a membro",
  MEMBER_ROLE_REMOVE: "Cargo removido de membro",
  MEMBER_NICKNAME_UPDATE: "Apelido de membro atualizado",
  MEMBER_KICK: "Membro expulso",
  MEMBER_BAN: "Membro banido",
  MEMBER_UNBAN: "Banimento removido",
  CHANNEL_CREATE: "Canal criado",
  CHANNEL_UPDATE: "Canal atualizado",
  CHANNEL_DELETE: "Canal excluído",
  CHANNEL_OVERWRITE_UPDATE: "Permissões de canal atualizadas",
  CHANNEL_OVERWRITE_DELETE: "Permissões de canal restauradas",
  CATEGORY_CREATE: "Categoria criada",
  CATEGORY_UPDATE: "Categoria atualizada",
  CATEGORY_DELETE: "Categoria excluída",
  EMOJI_CREATE: "Emoji criado",
  EMOJI_DELETE: "Emoji excluído",
};

function safeBigInt(value: unknown) {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function displayName(user: any) {
  return user?.globalName || user?.username || "Usuário";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function GuildSettingsModal({ isOpen, onClose, guild }: Props) {
  const router = useRouter();
  const iconRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLInputElement>(null);
  const noticeTimer = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [extrasLoading, setExtrasLoading] = useState(false);
  const [extras, setExtras] = useState<Extras | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [banner, setBanner] = useState("");
  const [vanityUrl, setVanityUrl] = useState("");

  const [roleSearch, setRoleSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(permissionGroups.map((group) => [group.title, true])),
  );
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState<RoleDraft>({
    name: "Novo Cargo",
    color: "#5865F2",
    hoist: false,
    mentionable: false,
    permissions: "0",
  });

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [moderationReason, setModerationReason] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"GUILD_TEXT" | "GUILD_VOICE" | "GUILD_VIDEO" | "GUILD_ANNOUNCEMENT">("GUILD_TEXT");
  const [channelCategoryId, setChannelCategoryId] = useState("");

  const [emojiName, setEmojiName] = useState("");
  const [emojiUploadKey, setEmojiUploadKey] = useState("");
  const [emojiUploading, setEmojiUploading] = useState(false);

  const [advancedConfirmName, setAdvancedConfirmName] = useState("");
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const roles = useMemo(
    () => [...(guild?.roles ?? [])].sort((a: any, b: any) => b.position - a.position),
    [guild?.roles],
  );

  const members = useMemo(() => guild?.members ?? [], [guild?.members]);
  const categories = useMemo(
    () => [...(guild?.categories ?? [])].sort((a: any, b: any) => a.position - b.position),
    [guild?.categories],
  );

  const uncategorizedChannels = useMemo(
    () =>
      (guild?.channels ?? [])
        .filter((channel: any) => !channel.categoryId && !channel.parentId)
        .sort((a: any, b: any) => a.position - b.position),
    [guild?.channels],
  );

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return roles;
    return roles.filter((role: any) =>
      String(role.name).toLocaleLowerCase("pt-BR").includes(query),
    );
  }, [roleSearch, roles]);

  const selectedRole = useMemo(
    () => roles.find((role: any) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const selectedRoleDraft = selectedRole
    ? roleDrafts[selectedRole.id] ?? {
        name: selectedRole.name,
        color: selectedRole.color || "#99aab5",
        hoist: Boolean(selectedRole.hoist),
        mentionable: Boolean(selectedRole.mentionable),
        permissions: String(selectedRole.permissions ?? "0"),
      }
    : null;

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return members;

    return members.filter((member: any) => {
      const values = [
        member.nickname,
        member.user?.username,
        member.user?.globalName,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLocaleLowerCase("pt-BR"));
      return values.some((value) => value.includes(query));
    });
  }, [memberSearch, members]);

  const selectedMember = useMemo(
    () => members.find((member: any) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const ownerCandidates = useMemo(
    () => members.filter((member: any) => member.userId !== extras?.guild.ownerId && !member.user?.bot),
    [members, extras?.guild.ownerId],
  );

  const showNotice = useCallback((type: Notice["type"], text: string) => {
    setNotice({ type, text });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3500);
  }, []);

  const loadExtras = useCallback(async () => {
    if (!guild?.id) return;
    setExtrasLoading(true);
    try {
      const data = await getGuildSettingsExtras(guild.id);
      setExtras(data);
      setVanityUrl(data.guild.vanityUrl ?? "");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível carregar as configurações administrativas.");
    } finally {
      setExtrasLoading(false);
    }
  }, [guild, showNotice]);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !guild) return;

    setTab("overview");
    setName(guild.name ?? "");
    setIcon(guild.iconUrl ?? "");
    setBanner(guild.bannerUrl ?? "");
    setVanityUrl(guild.vanityUrl ?? "");
    setSelectedRoleId(null);
    setSelectedMemberId(null);
    setPermissionSearch("");
    setRoleSearch("");
    setMemberSearch("");
    setConfirmState(null);
    setAdvancedConfirmName("");
    void loadExtras();
  }, [guild, isOpen, loadExtras]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmState || createRoleOpen) {
          setConfirmState(null);
          setCreateRoleOpen(false);
          return;
        }
        if (!loading) onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmState, createRoleOpen, isOpen, loading, onClose]);

  useEffect(() => {
    if (!selectedMember) {
      setNicknameDraft("");
      return;
    }
    setNicknameDraft(selectedMember.nickname ?? "");
  }, [selectedMember]);

  function updateRoleDraft(patch: Partial<RoleDraft>) {
    if (!selectedRole) return;
    setRoleDrafts((current) => ({
      ...current,
      [selectedRole.id]: {
        ...(current[selectedRole.id] ?? {
          name: selectedRole.name,
          color: selectedRole.color || "#99aab5",
          hoist: Boolean(selectedRole.hoist),
          mentionable: Boolean(selectedRole.mentionable),
          permissions: String(selectedRole.permissions ?? "0"),
        }),
        ...patch,
      },
    }));
  }

  function roleHasPermission(permission: PermissionName) {
    if (!selectedRoleDraft) return false;
    const bits = safeBigInt(selectedRoleDraft.permissions);
    return (bits & Permissions[permission]) === Permissions[permission];
  }

  function togglePermission(permission: PermissionName, enabled: boolean) {
    if (!selectedRoleDraft || selectedRole?.managed) return;
    let bits = safeBigInt(selectedRoleDraft.permissions);
    const value = Permissions[permission];
    bits = enabled ? bits | value : bits & ~value;
    updateRoleDraft({ permissions: bits.toString() });
  }

  async function uploadAsset(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "icon" | "banner" | "emoji",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showNotice("error", "Selecione uma imagem válida.");
      return;
    }

    const maxSize = kind === "emoji" ? 8 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      showNotice("error", kind === "emoji" ? "O emoji deve ter no máximo 8 MB." : "A imagem deve ter no máximo 25 MB.");
      return;
    }

    if (kind === "emoji") setEmojiUploading(true);
    else setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.key) {
        throw new Error(data?.message || "Falha no upload.");
      }

      if (kind === "icon") setIcon(data.key);
      if (kind === "banner") setBanner(data.key);
      if (kind === "emoji") setEmojiUploadKey(data.key);
      showNotice("success", "Imagem carregada com sucesso.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível enviar a imagem.");
    } finally {
      if (kind === "emoji") setEmojiUploading(false);
      else setLoading(false);
    }
  }

  async function saveOverview() {
    if (!guild?.id || loading) return;
    setLoading(true);
    try {
      await updateGuildProfile(guild.id, {
        name,
        iconUrl: icon || null,
        bannerUrl: banner || null,
        vanityUrl: vanityUrl || null,
      });
      router.refresh();
      await loadExtras();
      showNotice("success", "Configurações do servidor salvas.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível salvar o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function saveRole() {
    if (!selectedRole || !selectedRoleDraft || loading) return;
    if (selectedRole.managed) return;

    if (!selectedRole.isDefault && !selectedRoleDraft.name.trim()) {
      showNotice("error", "O cargo precisa ter um nome.");
      return;
    }

    setLoading(true);
    try {
      if (selectedRole.isDefault) {
        await updateDefaultRolePermissions(
          guild.id,
          selectedRole.id,
          selectedRoleDraft.permissions,
        );
      } else {
        await updateRole(selectedRole.id, {
          name: selectedRoleDraft.name.trim(),
          color: selectedRoleDraft.color,
          hoist: selectedRoleDraft.hoist,
          mentionable: selectedRoleDraft.mentionable,
          permissions: selectedRoleDraft.permissions,
          position: selectedRole.position,
        });
      }
      router.refresh();
      showNotice("success", selectedRole.isDefault ? "Permissões do @everyone atualizadas." : "Cargo atualizado.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível atualizar o cargo.");
    } finally {
      setLoading(false);
    }
  }

  async function createNewRole() {
    if (!guild?.id || loading || !newRole.name.trim()) return;
    setLoading(true);
    try {
      const role = await createRole(guild.id, {
        ...newRole,
        name: newRole.name.trim(),
      });
      setCreateRoleOpen(false);
      setNewRole({
        name: "Novo Cargo",
        color: "#5865F2",
        hoist: false,
        mentionable: false,
        permissions: "0",
      });
      setSelectedRoleId(role.id);
      router.refresh();
      showNotice("success", "Cargo criado.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível criar o cargo.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteRole(role: any) {
    setLoading(true);
    try {
      await deleteRole(role.id);
      setSelectedRoleId(null);
      setConfirmState(null);
      router.refresh();
      showNotice("success", "Cargo excluído.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível excluir o cargo.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleMemberRoleSafe(member: any, role: any) {
    if (loading) return;
    setLoading(true);
    try {
      await toggleMemberRole(member.id, role.id);
      router.refresh();
      showNotice("success", "Cargos do membro atualizados.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível alterar o cargo.");
    } finally {
      setLoading(false);
    }
  }

  async function saveNickname() {
    if (!selectedMember || loading) return;
    setLoading(true);
    try {
      await updateGuildMemberNickname(selectedMember.id, nicknameDraft || null);
      router.refresh();
      showNotice("success", "Apelido atualizado.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível atualizar o apelido.");
    } finally {
      setLoading(false);
    }
  }

  async function moderateMember(kind: "kick" | "ban", member: any) {
    setLoading(true);
    try {
      if (kind === "kick") await kickGuildMember(member.id, moderationReason || null);
      else await banGuildMember(member.id, moderationReason || null);

      setConfirmState(null);
      setSelectedMemberId(null);
      setModerationReason("");
      router.refresh();
      await loadExtras();
      showNotice("success", kind === "kick" ? "Membro expulso." : "Membro banido.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível moderar o membro.");
    } finally {
      setLoading(false);
    }
  }

  async function unban(userId: string) {
    if (!guild?.id || loading) return;
    setLoading(true);
    try {
      await unbanGuildMember(guild.id, userId);
      await loadExtras();
      showNotice("success", "Banimento removido.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível remover o banimento.");
    } finally {
      setLoading(false);
    }
  }

  async function createCategory() {
    if (!guild?.id || !categoryName.trim() || loading) return;
    setLoading(true);
    try {
      await createGuildCategory(guild.id, categoryName);
      setCategoryName("");
      router.refresh();
      showNotice("success", "Categoria criada.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível criar a categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function renameCategory(categoryId: string) {
    if (!editingCategoryName.trim() || loading) return;
    setLoading(true);
    try {
      await renameGuildCategory(categoryId, editingCategoryName);
      setEditingCategoryId(null);
      setEditingCategoryName("");
      router.refresh();
      showNotice("success", "Categoria renomeada.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível renomear a categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function removeCategory(category: any) {
    setLoading(true);
    try {
      await deleteGuildCategory(category.id);
      setConfirmState(null);
      router.refresh();
      showNotice("success", "Categoria excluída. Os canais foram movidos para fora dela.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível excluir a categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function createNewChannel() {
    if (!guild?.id || !channelName.trim() || loading) return;
    setLoading(true);
    try {
      await createChannel(guild.id, channelName, channelType, channelCategoryId || null);
      setChannelName("");
      router.refresh();
      showNotice("success", "Canal criado.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível criar o canal.");
    } finally {
      setLoading(false);
    }
  }

  async function createEmoji() {
    if (!guild?.id || !emojiName.trim() || !emojiUploadKey || loading) return;
    setLoading(true);
    try {
      await createGuildEmoji(guild.id, { name: emojiName, url: emojiUploadKey });
      setEmojiName("");
      setEmojiUploadKey("");
      await loadExtras();
      showNotice("success", "Emoji adicionado.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível criar o emoji.");
    } finally {
      setLoading(false);
    }
  }

  async function removeEmoji(emoji: any) {
    setLoading(true);
    try {
      await deleteGuildEmoji(emoji.id);
      setConfirmState(null);
      await loadExtras();
      showNotice("success", "Emoji excluído.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível excluir o emoji.");
    } finally {
      setLoading(false);
    }
  }

  async function transferOwnership() {
    if (!guild?.id || !newOwnerUserId || loading) return;
    setLoading(true);
    try {
      await transferGuildOwnership(guild.id, newOwnerUserId);
      router.refresh();
      await loadExtras();
      setNewOwnerUserId("");
      showNotice("success", "Propriedade transferida.");
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível transferir a propriedade.");
    } finally {
      setLoading(false);
    }
  }

  async function leaveServer() {
    if (!guild?.id || loading) return;
    setLoading(true);
    try {
      await leaveGuild(guild.id);
      onClose();
      router.push("/channels/@me");
      router.refresh();
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível sair do servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteServer() {
    if (!guild?.id || loading) return;
    setLoading(true);
    try {
      await deleteGuildPermanently(guild.id, advancedConfirmName);
      onClose();
      router.push("/channels/@me");
      router.refresh();
    } catch (error: any) {
      showNotice("error", error?.message || "Não foi possível excluir o servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!mounted || !isOpen || !guild) return null;

  const capabilities = extras?.capabilities;

  const content = (
    <div className="fixed inset-0 z-[99999] overflow-hidden bg-white text-zinc-950 dark:bg-[#0f1012] dark:text-zinc-100">
      <input
        ref={iconRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => void uploadAsset(event, "icon")}
      />
      <input
        ref={bannerRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => void uploadAsset(event, "banner")}
      />
      <input
        ref={emojiRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => void uploadAsset(event, "emoji")}
      />

      <div className="flex h-full min-h-0 min-w-[900px] overflow-hidden">
        <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-zinc-200 bg-[#f7f7f8] dark:border-white/[0.07] dark:bg-[#111214]">
          <div className="shrink-0 border-b border-zinc-200 px-5 py-5 dark:border-white/[0.07]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-zinc-900 text-white dark:bg-zinc-800">
                {guild.iconUrl ? (
                  <Avatar avatarUrl={guild.iconUrl} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold">
                    {String(guild.name || "S").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Configurações do servidor
                </div>
                <div className="mt-1 truncate text-sm font-bold text-zinc-900 dark:text-white">
                  {guild.name}
                </div>
              </div>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 [scrollbar-width:thin]">
            <NavGroup label="Servidor">
              <NavButton
                active={tab === "overview"}
                icon={<Settings2 size={17} />}
                label="Visão geral"
                onClick={() => setTab("overview")}
              />
              <NavButton
                active={tab === "roles"}
                icon={<Shield size={17} />}
                label="Cargos e permissões"
                badge={roles.length}
                onClick={() => setTab("roles")}
              />
              <NavButton
                active={tab === "members"}
                icon={<Users size={17} />}
                label="Membros"
                badge={members.length}
                onClick={() => setTab("members")}
              />
              <NavButton
                active={tab === "channels"}
                icon={<Hash size={17} />}
                label="Canais e categorias"
                badge={guild.channels?.length ?? 0}
                onClick={() => setTab("channels")}
              />
            </NavGroup>

            <NavGroup label="Comunidade">
              <NavButton
                active={tab === "invites"}
                icon={<Link size={17} />}
                label="Convites"
                onClick={() => setTab("invites")}
              />
              <NavButton
                active={tab === "emojis"}
                icon={<Smile size={17} />}
                label="Emojis"
                badge={extras?.guild._count.emojis ?? 0}
                onClick={() => setTab("emojis")}
              />
              <NavButton
                active={tab === "production"}
                icon={<Sparkles size={17} />}
                label="Produção"
                onClick={() => setTab("production")}
              />
            </NavGroup>

            <NavGroup label="Moderação">
              <NavButton
                active={tab === "bans"}
                icon={<Ban size={17} />}
                label="Banimentos"
                badge={extras?.guild._count.bans ?? 0}
                onClick={() => setTab("bans")}
              />
              <NavButton
                active={tab === "audit"}
                icon={<FileClock size={17} />}
                label="Registro de auditoria"
                onClick={() => setTab("audit")}
              />
            </NavGroup>

            <NavGroup label="Sistema">
              <NavButton
                active={tab === "advanced"}
                icon={<ShieldAlert size={17} />}
                label="Avançado"
                onClick={() => setTab("advanced")}
              />
            </NavGroup>
          </nav>

          <div className="shrink-0 border-t border-zinc-200 p-3 dark:border-white/[0.07]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-200/70 hover:text-zinc-950 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <X size={17} />
              Fechar configurações
            </button>
          </div>
        </aside>

        <main className="relative min-w-0 flex-1 overflow-hidden bg-white dark:bg-[#161719]">
          <div className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8 dark:border-white/[0.07] dark:bg-[#161719]">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-zinc-900 dark:text-white">
                {tabTitle(tab)}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {tabSubtitle(tab)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadExtras()}
                disabled={extrasLoading}
                title="Atualizar dados"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] dark:hover:text-white"
              >
                <RefreshCw size={16} className={extrasLoading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.07] dark:hover:text-white"
                aria-label="Fechar"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="h-full overflow-y-auto overscroll-contain px-8 pb-10 pt-24 [scrollbar-width:thin]">
            <div className="mx-auto w-full max-w-[1180px]">
              {tab === "overview" && (
                <OverviewTab
                  guild={guild}
                  extras={extras}
                  name={name}
                  setName={setName}
                  icon={icon}
                  banner={banner}
                  vanityUrl={vanityUrl}
                  setVanityUrl={setVanityUrl}
                  iconRef={iconRef}
                  bannerRef={bannerRef}
                  loading={loading}
                  canManage={Boolean(capabilities?.canManageGuild)}
                  onSave={() => void saveOverview()}
                />
              )}

              {tab === "roles" && (
                <RolesTab
                  roles={filteredRoles}
                  roleSearch={roleSearch}
                  setRoleSearch={setRoleSearch}
                  selectedRole={selectedRole}
                  selectedRoleId={selectedRoleId}
                  setSelectedRoleId={setSelectedRoleId}
                  draft={selectedRoleDraft}
                  updateDraft={updateRoleDraft}
                  permissionSearch={permissionSearch}
                  setPermissionSearch={setPermissionSearch}
                  expandedGroups={expandedGroups}
                  setExpandedGroups={setExpandedGroups}
                  roleHasPermission={roleHasPermission}
                  togglePermission={togglePermission}
                  loading={loading}
                  canManage={Boolean(capabilities?.canManageRoles)}
                  onCreate={() => setCreateRoleOpen(true)}
                  onSave={() => void saveRole()}
                  onDelete={(role) => setConfirmState({ type: "delete-role", role })}
                />
              )}

              {tab === "members" && (
                <MembersTab
                  members={filteredMembers}
                  allRoles={roles}
                  selectedMember={selectedMember}
                  selectedMemberId={selectedMemberId}
                  setSelectedMemberId={setSelectedMemberId}
                  memberSearch={memberSearch}
                  setMemberSearch={setMemberSearch}
                  nicknameDraft={nicknameDraft}
                  setNicknameDraft={setNicknameDraft}
                  loading={loading}
                  ownerId={extras?.guild.ownerId ?? guild.ownerId}
                  capabilities={capabilities}
                  onSaveNickname={() => void saveNickname()}
                  onToggleRole={(member, role) => void toggleMemberRoleSafe(member, role)}
                  onKick={(member) => {
                    setModerationReason("");
                    setConfirmState({ type: "kick", member });
                  }}
                  onBan={(member) => {
                    setModerationReason("");
                    setConfirmState({ type: "ban", member });
                  }}
                />
              )}

              {tab === "channels" && (
                <ChannelsTab
                  categories={categories}
                  uncategorizedChannels={uncategorizedChannels}
                  categoryName={categoryName}
                  setCategoryName={setCategoryName}
                  editingCategoryId={editingCategoryId}
                  editingCategoryName={editingCategoryName}
                  setEditingCategoryName={setEditingCategoryName}
                  startEditingCategory={(category) => {
                    setEditingCategoryId(category.id);
                    setEditingCategoryName(category.name);
                  }}
                  cancelEditingCategory={() => {
                    setEditingCategoryId(null);
                    setEditingCategoryName("");
                  }}
                  channelName={channelName}
                  setChannelName={setChannelName}
                  channelType={channelType}
                  setChannelType={setChannelType}
                  channelCategoryId={channelCategoryId}
                  setChannelCategoryId={setChannelCategoryId}
                  loading={loading}
                  canManage={Boolean(capabilities?.canManageChannels)}
                  onCreateCategory={() => void createCategory()}
                  onRenameCategory={(id) => void renameCategory(id)}
                  onDeleteCategory={(category) => setConfirmState({ type: "delete-category", category })}
                  onCreateChannel={() => void createNewChannel()}
                />
              )}

              {tab === "invites" && (
                <Gate
                  allowed={Boolean(capabilities?.canCreateInvites)}
                  loading={extrasLoading}
                  title="Sem permissão para gerenciar convites"
                  description="Você precisa da permissão Criar Convites para visualizar e revogar os convites deste servidor."
                >
                  <InvitesSettings guild={guild} />
                </Gate>
              )}

              {tab === "emojis" && (
                <EmojisTab
                  emojis={extras?.guild.emojis ?? []}
                  emojiName={emojiName}
                  setEmojiName={setEmojiName}
                  emojiUploadKey={emojiUploadKey}
                  emojiRef={emojiRef}
                  emojiUploading={emojiUploading}
                  loading={loading || extrasLoading}
                  canManage={Boolean(capabilities?.canManageExpressions)}
                  onCreate={() => void createEmoji()}
                  onDelete={(emoji) => setConfirmState({ type: "delete-emoji", emoji })}
                />
              )}

              {tab === "production" && (
                <ProductionTab
                  guild={guild}
                  roles={roles}
                  members={members}
                  channels={guild.channels ?? []}
                  extras={extras}
                  loading={loading || extrasLoading}
                  capabilities={capabilities}
                  showNotice={showNotice}
                  reload={() => void loadExtras()}
                />
              )}

              {tab === "bans" && (
                <BansTab
                  bans={extras?.bans ?? []}
                  loading={extrasLoading || loading}
                  canManage={Boolean(capabilities?.canBanMembers)}
                  onUnban={(userId) => void unban(userId)}
                />
              )}

              {tab === "audit" && (
                <AuditTab
                  logs={extras?.auditLogs ?? []}
                  loading={extrasLoading}
                  canView={Boolean(capabilities?.canViewAuditLog)}
                />
              )}

              {tab === "advanced" && (
                <AdvancedTab
                  guild={guild}
                  extras={extras}
                  ownerCandidates={ownerCandidates}
                  newOwnerUserId={newOwnerUserId}
                  setNewOwnerUserId={setNewOwnerUserId}
                  confirmName={advancedConfirmName}
                  setConfirmName={setAdvancedConfirmName}
                  loading={loading || extrasLoading}
                  onTransfer={() => void transferOwnership()}
                  onLeave={() => void leaveServer()}
                  onDelete={() => void deleteServer()}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {notice && <Toast notice={notice} />}

      {createRoleOpen && (
        <Dialog title="Criar cargo" onClose={() => !loading && setCreateRoleOpen(false)}>
          <div className="space-y-4">
            <Field label="Nome do cargo">
              <TextInput
                value={newRole.name}
                onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
                maxLength={100}
              />
            </Field>
            <Field label="Cor">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={newRole.color}
                  onChange={(event) => setNewRole((current) => ({ ...current, color: event.target.value }))}
                  className="h-11 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-[#111214]"
                />
                <TextInput
                  value={newRole.color}
                  onChange={(event) => setNewRole((current) => ({ ...current, color: event.target.value }))}
                  maxLength={7}
                />
              </div>
            </Field>
            <SwitchRow
              checked={newRole.hoist}
              onChange={(value) => setNewRole((current) => ({ ...current, hoist: value }))}
              title="Exibir separadamente"
              description="Mostra membros deste cargo separados na lista de membros."
            />
            <SwitchRow
              checked={newRole.mentionable}
              onChange={(value) => setNewRole((current) => ({ ...current, mentionable: value }))}
              title="Permitir menções"
              description="Permite que outros membros mencionem este cargo."
            />
          </div>
          <DialogFooter>
            <SecondaryButton onClick={() => setCreateRoleOpen(false)} disabled={loading}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton onClick={() => void createNewRole()} disabled={loading || !newRole.name.trim()}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Criar cargo
            </PrimaryButton>
          </DialogFooter>
        </Dialog>
      )}

      {confirmState?.type === "kick" && (
        <ModerationDialog
          title={`Expulsar ${displayName(confirmState.member.user)}?`}
          description="A pessoa poderá entrar novamente usando um convite válido."
          reason={moderationReason}
          setReason={setModerationReason}
          loading={loading}
          destructiveLabel="Expulsar membro"
          onClose={() => setConfirmState(null)}
          onConfirm={() => void moderateMember("kick", confirmState.member)}
        />
      )}

      {confirmState?.type === "ban" && (
        <ModerationDialog
          title={`Banir ${displayName(confirmState.member.user)}?`}
          description="O membro será removido e ficará impedido de entrar novamente até que o banimento seja removido."
          reason={moderationReason}
          setReason={setModerationReason}
          loading={loading}
          destructiveLabel="Banir membro"
          onClose={() => setConfirmState(null)}
          onConfirm={() => void moderateMember("ban", confirmState.member)}
        />
      )}

      {confirmState?.type === "delete-role" && (
        <ConfirmDialog
          title="Excluir cargo?"
          description={`O cargo “${confirmState.role.name}” será removido de todos os membros. Esta ação não pode ser desfeita.`}
          loading={loading}
          confirmLabel="Excluir cargo"
          onClose={() => setConfirmState(null)}
          onConfirm={() => void confirmDeleteRole(confirmState.role)}
        />
      )}

      {confirmState?.type === "delete-category" && (
        <ConfirmDialog
          title="Excluir categoria?"
          description={`A categoria “${confirmState.category.name}” será excluída. Os canais não serão apagados; eles ficarão sem categoria.`}
          loading={loading}
          confirmLabel="Excluir categoria"
          onClose={() => setConfirmState(null)}
          onConfirm={() => void removeCategory(confirmState.category)}
        />
      )}

      {confirmState?.type === "delete-emoji" && (
        <ConfirmDialog
          title="Excluir emoji?"
          description={`O emoji :${confirmState.emoji.name}: será removido permanentemente deste servidor.`}
          loading={loading}
          confirmLabel="Excluir emoji"
          onClose={() => setConfirmState(null)}
          onConfirm={() => void removeEmoji(confirmState.emoji)}
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
}

function OverviewTab({
  guild,
  extras,
  name,
  setName,
  icon,
  banner,
  vanityUrl,
  setVanityUrl,
  iconRef,
  bannerRef,
  loading,
  canManage,
  onSave,
}: {
  guild: any;
  extras: Extras | null;
  name: string;
  setName: (value: string) => void;
  icon: string;
  banner: string;
  vanityUrl: string;
  setVanityUrl: (value: string) => void;
  iconRef: React.RefObject<HTMLInputElement | null>;
  bannerRef: React.RefObject<HTMLInputElement | null>;
  loading: boolean;
  canManage: boolean;
  onSave: () => void;
}) {
  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Server size={22} />}
        title="Visão geral"
        description="Identidade, URL personalizada e informações principais do servidor."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_320px]">
        <Card className="overflow-hidden p-0">
          <div className="relative h-52 overflow-hidden bg-gradient-to-br from-indigo-500/30 via-indigo-400/10 to-zinc-100 dark:to-[#1e1f22]">
            {banner ? (
              <Banner bannerUrl={banner} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <button
              type="button"
              onClick={() => bannerRef.current?.click()}
              disabled={!canManage || loading}
              className="absolute right-4 top-4 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus size={15} />
              Alterar banner
            </button>
            <div className="absolute bottom-[-38px] left-6">
              <button
                type="button"
                onClick={() => iconRef.current?.click()}
                disabled={!canManage || loading}
                className="group relative h-24 w-24 overflow-hidden rounded-[28px] border-4 border-white bg-indigo-500 shadow-lg disabled:cursor-not-allowed dark:border-[#1e1f22]"
              >
                {icon ? (
                  <Avatar avatarUrl={icon} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">
                    {String(name || guild.name || "S").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition group-hover:opacity-100">
                  <ImagePlus size={20} />
                </span>
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 pb-6 pt-14">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Nome do servidor" description="Até 100 caracteres.">
                <TextInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={100}
                  disabled={!canManage || loading}
                />
              </Field>
              <Field
                label="URL personalizada"
                description="3–32 caracteres: letras minúsculas, números, hífen ou underscore."
              >
                <div className="flex h-11 overflow-hidden rounded-xl border border-zinc-200 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214]">
                  <span className="flex shrink-0 items-center border-r border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]">
                    /invite/
                  </span>
                  <input
                    value={vanityUrl}
                    onChange={(event) => setVanityUrl(event.target.value.toLowerCase())}
                    maxLength={32}
                    disabled={!canManage || loading}
                    placeholder="meu-servidor"
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm text-zinc-900 outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-white"
                  />
                </div>
              </Field>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-5 dark:border-white/[0.07]">
              <div className="text-xs text-zinc-500">
                {canManage
                  ? "As alterações só são publicadas quando você salvar."
                  : "Você não possui Gerenciar Servidor."}
              </div>
              <PrimaryButton onClick={onSave} disabled={!canManage || loading || !name.trim()}>
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar alterações
              </PrimaryButton>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle icon={<CircleGauge size={16} />} title="Resumo" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Membros" value={extras?.guild._count.members ?? guild.members?.length ?? 0} />
              <Stat label="Cargos" value={extras?.guild._count.roles ?? guild.roles?.length ?? 0} />
              <Stat label="Canais" value={extras?.guild._count.channels ?? guild.channels?.length ?? 0} />
              <Stat label="Categorias" value={extras?.guild._count.categories ?? guild.categories?.length ?? 0} />
              <Stat label="Emojis" value={extras?.guild._count.emojis ?? 0} />
              <Stat label="Bans" value={extras?.guild._count.bans ?? 0} />
            </div>
          </Card>

          <Card>
            <SectionTitle icon={<Crown size={16} />} title="Propriedade" />
            <div className="mt-4 flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
                {extras?.guild.owner?.avatarUrl ? (
                  <Avatar avatarUrl={extras.guild.owner.avatarUrl} className="h-full w-full" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-500">
                    <Users size={17} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold">
                  {extras?.guild.owner ? displayName(extras.guild.owner) : "Carregando..."}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  @{extras?.guild.owner?.username ?? "—"}
                </div>
              </div>
              {extras?.guild.verified && (
                <span className="ml-auto flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                  <ShieldCheck size={12} />
                  Verificado
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-white/[0.07]">
              <InfoLine label="Criado em" value={formatDate(extras?.guild.createdAt)} />
              <InfoLine label="Atualizado em" value={formatDate(extras?.guild.updatedAt)} />
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function RolesTab({
  roles,
  roleSearch,
  setRoleSearch,
  selectedRole,
  selectedRoleId,
  setSelectedRoleId,
  draft,
  updateDraft,
  permissionSearch,
  setPermissionSearch,
  expandedGroups,
  setExpandedGroups,
  roleHasPermission,
  togglePermission,
  loading,
  canManage,
  onCreate,
  onSave,
  onDelete,
}: any) {
  const visibleGroups = useMemo(() => {
    const query = permissionSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return permissionGroups;
    return permissionGroups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((permission) =>
          String(PERMISSION_LABELS[permission] ?? permission)
            .toLocaleLowerCase("pt-BR")
            .includes(query),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [permissionSearch]);

  const locked = !canManage || selectedRole?.managed;

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Shield size={22} />}
        title="Cargos e permissões"
        description="Organize a hierarquia e defina as permissões-base de cada cargo. Permissões específicas de canal continuam nos ajustes do canal."
        action={
          <PrimaryButton onClick={onCreate} disabled={!canManage || loading}>
            <Plus size={15} />
            Criar cargo
          </PrimaryButton>
        }
      />

      <div className="grid h-[calc(100dvh-210px)] min-h-[580px] max-h-[820px] grid-cols-[300px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#1e1f22]">
        <div className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-white/[0.07]">
          <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-white/[0.07]">
            <SearchInput value={roleSearch} onChange={setRoleSearch} placeholder="Pesquisar cargos" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {roles.map((role: any) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={classNames(
                  "group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  selectedRoleId === role.id
                    ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.05]",
                )}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: role.color || "#99aab5" }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {role.isDefault ? "@everyone" : role.name}
                </span>
                {role.managed && <Lock size={13} className="shrink-0 text-zinc-500" />}
                {role.isDefault && (
                  <span className="shrink-0 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-zinc-500 dark:bg-white/[0.07]">
                    base
                  </span>
                )}
                <ChevronRight size={14} className="shrink-0 text-zinc-400" />
              </button>
            ))}
            {roles.length === 0 && <EmptyState compact icon={<Shield size={22} />} title="Nenhum cargo encontrado" />}
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden">
          {!selectedRole || !draft ? (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={<Shield size={30} />}
                title="Selecione um cargo"
                description="Escolha um cargo à esquerda para editar identidade e permissões."
              />
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-zinc-200 px-5 py-4 dark:border-white/[0.07]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: draft.color || "#99aab5" }}
                    >
                      <Shield size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">
                        {selectedRole.isDefault ? "@everyone" : selectedRole.name}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Posição {selectedRole.position} · {selectedRole.managed ? "Cargo gerenciado" : selectedRole.isDefault ? "Cargo-base do servidor" : "Cargo personalizado"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedRole.isDefault && !selectedRole.managed && (
                      <DangerIconButton
                        title="Excluir cargo"
                        onClick={() => onDelete(selectedRole)}
                        disabled={!canManage || loading}
                      >
                        <Trash2 size={16} />
                      </DangerIconButton>
                    )}
                    <PrimaryButton onClick={onSave} disabled={locked || loading}>
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Salvar
                    </PrimaryButton>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
                <div className="space-y-6 p-5">
                  {selectedRole.managed && (
                    <Callout type="info" title="Cargo gerenciado">
                      Este cargo é controlado por uma integração ou bot e não pode ser editado manualmente.
                    </Callout>
                  )}

                  {!selectedRole.isDefault && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <Field label="Nome do cargo">
                        <TextInput
                          value={draft.name}
                          onChange={(event) => updateDraft({ name: event.target.value })}
                          disabled={locked || loading}
                          maxLength={100}
                        />
                      </Field>
                      <Field label="Cor do cargo">
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={draft.color}
                            onChange={(event) => updateDraft({ color: event.target.value })}
                            disabled={locked || loading}
                            className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[#111214]"
                          />
                          <TextInput
                            value={draft.color}
                            onChange={(event) => updateDraft({ color: event.target.value })}
                            disabled={locked || loading}
                            maxLength={7}
                          />
                        </div>
                      </Field>
                      <SwitchRow
                        checked={draft.hoist}
                        onChange={(value) => updateDraft({ hoist: value })}
                        disabled={locked || loading}
                        title="Exibir membros separadamente"
                        description="Separa membros deste cargo na lista lateral."
                      />
                      <SwitchRow
                        checked={draft.mentionable}
                        onChange={(value) => updateDraft({ mentionable: value })}
                        disabled={locked || loading}
                        title="Permitir menções ao cargo"
                        description="Outros membros poderão mencionar este cargo."
                      />
                    </div>
                  )}

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">Permissões</h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          As permissões são armazenadas como bitfield no cargo.
                        </p>
                      </div>
                      <div className="w-72">
                        <SearchInput
                          value={permissionSearch}
                          onChange={setPermissionSearch}
                          placeholder="Buscar permissão"
                        />
                      </div>
                    </div>

                    {roleHasPermission("ADMINISTRATOR") && (
                      <Callout type="danger" title="Administrador habilitado">
                        Este cargo ignora as restrições normais de permissões. Conceda apenas a pessoas totalmente confiáveis.
                      </Callout>
                    )}

                    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.07]">
                      {visibleGroups.map((group) => {
                        const expanded = expandedGroups[group.title] ?? true;
                        return (
                          <div key={group.title} className="border-b border-zinc-200 last:border-b-0 dark:border-white/[0.07]">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGroups((current: any) => ({ ...current, [group.title]: !expanded }))
                              }
                              className="flex w-full items-center gap-3 bg-zinc-50 px-4 py-3 text-left transition hover:bg-zinc-100 dark:bg-white/[0.025] dark:hover:bg-white/[0.045]"
                            >
                              <ChevronDown
                                size={15}
                                className={classNames("shrink-0 text-zinc-500 transition", !expanded && "-rotate-90")}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{group.title}</div>
                                <div className="mt-0.5 truncate text-[10px] text-zinc-500">{group.description}</div>
                              </div>
                            </button>
                            {expanded && (
                              <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
                                {group.permissions.map((permission) => (
                                  <PermissionToggle
                                    key={permission}
                                    label={String(PERMISSION_LABELS[permission] ?? permission)}
                                    checked={roleHasPermission(permission)}
                                    disabled={locked || loading}
                                    dangerous={permission === "ADMINISTRATOR"}
                                    onChange={(enabled) => togglePermission(permission, enabled)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {visibleGroups.length === 0 && (
                        <div className="p-8">
                          <EmptyState compact icon={<Search size={22} />} title="Nenhuma permissão encontrada" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MembersTab({
  members,
  allRoles,
  selectedMember,
  selectedMemberId,
  setSelectedMemberId,
  memberSearch,
  setMemberSearch,
  nicknameDraft,
  setNicknameDraft,
  loading,
  ownerId,
  capabilities,
  onSaveNickname,
  onToggleRole,
  onKick,
  onBan,
}: any) {
  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Users size={22} />}
        title="Membros"
        description="Gerencie cargos, apelidos e ações de moderação sem sair das configurações."
      />

      <div className="grid h-[calc(100dvh-210px)] min-h-[580px] max-h-[820px] grid-cols-[340px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#1e1f22]">
        <div className="flex min-h-0 flex-col border-r border-zinc-200 dark:border-white/[0.07]">
          <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-white/[0.07]">
            <SearchInput value={memberSearch} onChange={setMemberSearch} placeholder="Buscar membro" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
            {members.map((member: any) => (
              <button
                key={member.id}
                type="button"
                onClick={() => setSelectedMemberId(member.id)}
                className={classNames(
                  "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  selectedMemberId === member.id
                    ? "bg-indigo-500/10 dark:bg-indigo-500/15"
                    : "hover:bg-zinc-100 dark:hover:bg-white/[0.05]",
                )}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
                  {member.user?.avatarUrl ? (
                    <Avatar avatarUrl={member.user.avatarUrl} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-500">
                      {displayName(member.user).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{member.nickname || displayName(member.user)}</span>
                    {member.user?.bot && <Bot size={13} className="shrink-0 text-indigo-500" />}
                    {member.userId === ownerId && <Crown size={13} className="shrink-0 text-amber-500" />}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">@{member.user?.username}</div>
                </div>
                <ChevronRight size={14} className="shrink-0 text-zinc-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 min-w-0 overflow-hidden">
          {!selectedMember ? (
            <div className="flex h-full items-center justify-center p-8">
              <EmptyState
                icon={<UserCog size={30} />}
                title="Selecione um membro"
                description="Escolha alguém na lista para gerenciar cargos, apelido e moderação."
              />
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="shrink-0 border-b border-zinc-200 px-5 py-4 dark:border-white/[0.07]">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-white/[0.06]">
                    {selectedMember.user?.avatarUrl ? (
                      <Avatar avatarUrl={selectedMember.user.avatarUrl} className="h-full w-full" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-500">
                        {displayName(selectedMember.user).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold">{displayName(selectedMember.user)}</h3>
                      {selectedMember.userId === ownerId && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                          <Crown size={11} /> Dono
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      @{selectedMember.user?.username} · Entrou em {formatDate(selectedMember.joinedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin]">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-5">
                    <Card>
                      <SectionTitle icon={<AtSign size={16} />} title="Apelido no servidor" />
                      <div className="mt-4 flex gap-2">
                        <TextInput
                          value={nicknameDraft}
                          onChange={(event) => setNicknameDraft(event.target.value)}
                          disabled={!capabilities?.canManageNicknames || loading || selectedMember.userId === ownerId}
                          maxLength={100}
                          placeholder="Sem apelido"
                        />
                        <PrimaryButton
                          onClick={onSaveNickname}
                          disabled={!capabilities?.canManageNicknames || loading || selectedMember.userId === ownerId}
                        >
                          <Save size={15} />
                          Salvar
                        </PrimaryButton>
                      </div>
                    </Card>

                    <Card>
                      <SectionTitle icon={<Shield size={16} />} title="Cargos" />
                      <div className="mt-4 space-y-2">
                        {allRoles
                          .filter((role: any) => !role.isDefault)
                          .map((role: any) => {
                            const hasRole = selectedMember.roles?.some((memberRole: any) => memberRole.id === role.id);
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => onToggleRole(selectedMember, role)}
                                disabled={!capabilities?.canManageRoles || loading || role.managed || selectedMember.userId === ownerId}
                                className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.07] dark:hover:bg-white/[0.035]"
                              >
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color || "#99aab5" }} />
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{role.name}</span>
                                {role.managed && <Lock size={13} className="text-zinc-500" />}
                                <span
                                  className={classNames(
                                    "flex h-5 w-5 items-center justify-center rounded-md border",
                                    hasRole
                                      ? "border-indigo-500 bg-indigo-500 text-white"
                                      : "border-zinc-300 dark:border-zinc-600",
                                  )}
                                >
                                  {hasRole && <Check size={13} strokeWidth={3} />}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-5">
                    <Card>
                      <SectionTitle icon={<Gauge size={16} />} title="Informações" />
                      <div className="mt-4 space-y-2 text-xs">
                        <InfoLine label="Status" value={selectedMember.user?.status ?? "OFFLINE"} />
                        <InfoLine label="Conta criada" value={formatDate(selectedMember.user?.createdAt)} />
                        <InfoLine label="Cargos" value={String(selectedMember.roles?.length ?? 0)} />
                      </div>
                    </Card>

                    {selectedMember.userId !== ownerId && (
                      <Card className="border-red-500/20">
                        <SectionTitle icon={<ShieldAlert size={16} />} title="Moderação" danger />
                        <div className="mt-4 space-y-2">
                          <DangerButton
                            disabled={!capabilities?.canKickMembers || loading}
                            onClick={() => onKick(selectedMember)}
                          >
                            <UserMinus size={15} />
                            Expulsar membro
                          </DangerButton>
                          <DangerButton
                            disabled={!capabilities?.canBanMembers || loading}
                            onClick={() => onBan(selectedMember)}
                          >
                            <Ban size={15} />
                            Banir membro
                          </DangerButton>
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ChannelsTab({
  categories,
  uncategorizedChannels,
  categoryName,
  setCategoryName,
  editingCategoryId,
  editingCategoryName,
  setEditingCategoryName,
  startEditingCategory,
  cancelEditingCategory,
  channelName,
  setChannelName,
  channelType,
  setChannelType,
  channelCategoryId,
  setChannelCategoryId,
  loading,
  canManage,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onCreateChannel,
}: any) {
  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Hash size={22} />}
        title="Canais e categorias"
        description="Organize a estrutura do servidor. Permissões específicas, bitrate, NSFW e demais detalhes ficam no menu do próprio canal."
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={<Blocks size={16} />} title="Estrutura atual" />
            <span className="text-xs text-zinc-500">{categories.length} categorias</span>
          </div>

          <div className="mt-4 space-y-3">
            {uncategorizedChannels.length > 0 && (
              <ChannelGroup name="Sem categoria" channels={uncategorizedChannels} />
            )}

            {categories.map((category: any) => (
              <div key={category.id} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.07]">
                <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2.5 dark:bg-white/[0.025]">
                  {editingCategoryId === category.id ? (
                    <>
                      <input
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        maxLength={100}
                        autoFocus
                        className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-semibold outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#111214]"
                      />
                      <button
                        type="button"
                        onClick={() => onRenameCategory(category.id)}
                        disabled={loading || !editingCategoryName.trim()}
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingCategory}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/[0.06]"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} className="shrink-0 text-zinc-500" />
                      <span className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                        {category.name}
                      </span>
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditingCategory(category)}
                            disabled={loading}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-40 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCategory(category)}
                            disabled={loading}
                            className="rounded-lg p-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
                  {(category.channels ?? []).map((channel: any) => (
                    <ChannelRow key={channel.id} channel={channel} />
                  ))}
                  {(category.channels ?? []).length === 0 && (
                    <div className="px-4 py-4 text-xs text-zinc-500">Nenhum canal nesta categoria.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle icon={<FolderPlus size={16} />} title="Nova categoria" />
            <div className="mt-4 space-y-3">
              <TextInput
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="Nome da categoria"
                maxLength={100}
                disabled={!canManage || loading}
              />
              <PrimaryButton
                className="w-full justify-center"
                onClick={onCreateCategory}
                disabled={!canManage || loading || !categoryName.trim()}
              >
                <Plus size={15} />
                Criar categoria
              </PrimaryButton>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={<Plus size={16} />} title="Novo canal" />
            <div className="mt-4 space-y-3">
              <Field label="Nome">
                <TextInput
                  value={channelName}
                  onChange={(event) => setChannelName(event.target.value)}
                  maxLength={100}
                  disabled={!canManage || loading}
                  placeholder="novo-canal"
                />
              </Field>
              <Field label="Tipo">
                <SelectInput
                  value={channelType}
                  onChange={(event) => setChannelType(event.target.value as "GUILD_TEXT" | "GUILD_VOICE" | "GUILD_VIDEO" | "GUILD_ANNOUNCEMENT")}
                  disabled={!canManage || loading}
                >
                  <option value="GUILD_TEXT">Canal de texto</option>
                  <option value="GUILD_VOICE">Canal de voz</option>
                  <option value="GUILD_VIDEO">Canal de vídeo</option>
                  <option value="GUILD_ANNOUNCEMENT">Canal de anúncios</option>
                </SelectInput>
              </Field>
              <Field label="Categoria">
                <SelectInput
                  value={channelCategoryId}
                  onChange={(event) => setChannelCategoryId(event.target.value)}
                  disabled={!canManage || loading}
                >
                  <option value="">Sem categoria</option>
                  {categories.map((category: any) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <PrimaryButton
                className="w-full justify-center"
                onClick={onCreateChannel}
                disabled={!canManage || loading || !channelName.trim()}
              >
                {channelType === "GUILD_VOICE" || channelType === "GUILD_VIDEO" ? <Volume2 size={15} /> : <Hash size={15} />}
                Criar canal
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}

function EmojisTab({
  emojis,
  emojiName,
  setEmojiName,
  emojiUploadKey,
  emojiRef,
  emojiUploading,
  loading,
  canManage,
  onCreate,
  onDelete,
}: any) {
  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Smile size={22} />}
        title="Emojis"
        description="Envie e gerencie emojis personalizados deste servidor."
      />

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <SectionTitle icon={<ImagePlus size={16} />} title="Adicionar emoji" />
          <div className="mt-4 space-y-4">
            <button
              type="button"
              onClick={() => emojiRef.current?.click()}
              disabled={!canManage || emojiUploading || loading}
              className="flex h-32 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-500 transition hover:border-indigo-400 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:bg-white/[0.025]"
            >
              {emojiUploading ? (
                <Loader2 size={24} className="animate-spin" />
              ) : emojiUploadKey ? (
                <>
                  <CheckCircle2 size={25} className="text-emerald-500" />
                  <span className="text-xs font-semibold">Imagem pronta</span>
                </>
              ) : (
                <>
                  <ImagePlus size={25} />
                  <span className="text-xs font-semibold">Selecionar imagem</span>
                </>
              )}
            </button>
            <Field label="Nome do emoji" description="2–32 caracteres, letras, números ou underscore.">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">:</span>
                <input
                  value={emojiName}
                  onChange={(event) => setEmojiName(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  maxLength={32}
                  disabled={!canManage || loading}
                  placeholder="meu_emoji"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-7 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#111214] dark:text-white"
                />
              </div>
            </Field>
            <PrimaryButton
              className="w-full justify-center"
              onClick={onCreate}
              disabled={!canManage || loading || emojiUploading || !emojiName.trim() || !emojiUploadKey}
            >
              <Plus size={15} />
              Adicionar emoji
            </PrimaryButton>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle icon={<Sparkles size={16} />} title="Emojis do servidor" />
            <span className="text-xs text-zinc-500">{emojis.length}</span>
          </div>
          <div className="mt-4 divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 dark:divide-white/[0.06] dark:border-white/[0.07]">
            {emojis.map((emoji: any) => (
              <div key={emoji.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/[0.05]">
                  <Avatar avatarUrl={emoji.url} className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">:{emoji.name}:</div>
                  <div className="mt-0.5 truncate text-[11px] text-zinc-500">
                    criado por {displayName(emoji.creator)} · {formatDate(emoji.createdAt)}
                  </div>
                </div>
                <DangerIconButton
                  title="Excluir emoji"
                  onClick={() => onDelete(emoji)}
                  disabled={!canManage || loading}
                >
                  <Trash2 size={16} />
                </DangerIconButton>
              </div>
            ))}
            {emojis.length === 0 && (
              <div className="p-10">
                <EmptyState compact icon={<Smile size={24} />} title="Nenhum emoji personalizado" />
              </div>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function ProductionTab({
  guild,
  roles,
  members,
  channels,
  extras,
  loading,
  capabilities,
  showNotice,
  reload,
}: any) {
  const [onboardingRules, setOnboardingRules] = useState(extras?.onboarding?.rules ?? "");
  const [onboardingQuestions, setOnboardingQuestions] = useState(
    Array.isArray(extras?.onboarding?.questions) ? extras.onboarding.questions.join("\n") : "",
  );
  const [onboardingEnabled, setOnboardingEnabled] = useState(Boolean(extras?.onboarding?.enabled));
  const [autoRoleIds, setAutoRoleIds] = useState<string[]>(extras?.onboarding?.autoRoleIds ?? []);
  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [autoModName, setAutoModName] = useState("");
  const [autoModTrigger, setAutoModTrigger] = useState("BLOCKED_WORD");
  const [autoModKeywords, setAutoModKeywords] = useState("");
  const [moderationMemberId, setModerationMemberId] = useState("");
  const [moderationReason, setModerationReason] = useState("");
  const [stickerName, setStickerName] = useState("");
  const [stickerUrl, setStickerUrl] = useState("");
  const [soundName, setSoundName] = useState("");
  const [soundUrl, setSoundUrl] = useState("");
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    setOnboardingRules(extras?.onboarding?.rules ?? "");
    setOnboardingQuestions(Array.isArray(extras?.onboarding?.questions) ? extras.onboarding.questions.join("\n") : "");
    setOnboardingEnabled(Boolean(extras?.onboarding?.enabled));
    setAutoRoleIds(extras?.onboarding?.autoRoleIds ?? []);
  }, [extras?.onboarding]);

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      showNotice("success", message);
      await reload();
    } catch (error: any) {
      showNotice("error", error?.message || "A ação não pôde ser concluída.");
    }
  }

  const manageableRoles = roles.filter((role: any) => !role.isDefault && !role.managed);
  const manageableMembers = members.filter((member: any) => member.userId !== guild.ownerId && !member.user?.bot);

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Sparkles size={22} />}
        title="Produção"
        description="Recursos avançados do servidor: onboarding, eventos, AutoMod, moderação, expressões, soundboard e templates."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle icon={<UserCog size={15} />} title="Server onboarding" />
          <div className="mt-4 space-y-3">
            <SwitchRow
              checked={onboardingEnabled}
              onChange={setOnboardingEnabled}
              title="Ativar onboarding"
              description="Mostra regras e aplica cargos automáticos para novos membros."
              disabled={!capabilities?.canManageGuild || loading}
            />
            <Field label="Regras do servidor">
              <textarea
                value={onboardingRules}
                onChange={(event) => setOnboardingRules(event.target.value)}
                rows={5}
                maxLength={5000}
                disabled={!capabilities?.canManageGuild || loading}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#111214] dark:text-white"
              />
            </Field>
            <Field label="Perguntas de entrada">
              <textarea
                value={onboardingQuestions}
                onChange={(event) => setOnboardingQuestions(event.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Uma pergunta por linha"
                disabled={!capabilities?.canManageGuild || loading}
                className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-indigo-500 dark:border-white/10 dark:bg-[#111214] dark:text-white"
              />
            </Field>
            <Field label="Cargos automáticos">
              <div className="grid gap-2 sm:grid-cols-2">
                {manageableRoles.slice(0, 12).map((role: any) => (
                  <label key={role.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-white/10">
                    <input
                      type="checkbox"
                      checked={autoRoleIds.includes(role.id)}
                      onChange={(event) =>
                        setAutoRoleIds((current) =>
                          event.target.checked
                            ? [...current, role.id]
                            : current.filter((id) => id !== role.id),
                        )
                      }
                    />
                    <span className="truncate">{role.name}</span>
                  </label>
                ))}
              </div>
            </Field>
            <PrimaryButton
              disabled={!capabilities?.canManageGuild || loading}
              onClick={() =>
                void run(
                  () =>
                    updateGuildOnboarding(guild.id, {
                      enabled: onboardingEnabled,
                      rules: onboardingRules,
                      autoRoleIds,
                      questions: onboardingQuestions
                        .split("\n")
                        .map((question: string) => question.trim())
                        .filter(Boolean)
                        .slice(0, 10),
                      suggestedChannels: channels
                        .filter((channel: any) => channel.type === "GUILD_TEXT")
                        .slice(0, 5)
                        .map((channel: any) => ({ id: channel.id, name: channel.name })),
                    }),
                  "Onboarding salvo.",
                )
              }
            >
              <Save size={15} />
              Salvar onboarding
            </PrimaryButton>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<FileClock size={15} />} title="Eventos agendados" />
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput value={eventName} onChange={(event) => setEventName(event.target.value)} placeholder="Nome do evento" />
              <TextInput value={eventStart} onChange={(event) => setEventStart(event.target.value)} type="datetime-local" />
            </div>
            <PrimaryButton
              disabled={!capabilities?.canCreateEvents || loading || !eventName || !eventStart}
              onClick={() =>
                void run(
                  () => createScheduledEvent(guild.id, { name: eventName, scheduledStartAt: new Date(eventStart).toISOString() }),
                  "Evento criado.",
                )
              }
            >
              <Plus size={15} />
              Criar evento
            </PrimaryButton>
            <div className="space-y-2">
              {(extras?.scheduledEvents ?? []).slice(0, 6).map((event: any) => (
                <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-white/10">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{event.name}</div>
                    <div className="text-xs text-zinc-500">{formatDate(event.scheduledStartAt)} · {event.status}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {event.status === "SCHEDULED" && (
                      <SecondaryButton disabled={!capabilities?.canManageEvents || loading} onClick={() => void run(() => updateScheduledEventStatus(event.id, "ACTIVE"), "Evento iniciado.")}>
                        Iniciar
                      </SecondaryButton>
                    )}
                    {event.status !== "COMPLETED" && (
                      <SecondaryButton disabled={!capabilities?.canManageEvents || loading} onClick={() => void run(() => updateScheduledEventStatus(event.id, "COMPLETED"), "Evento finalizado.")}>
                        Finalizar
                      </SecondaryButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<ShieldAlert size={15} />} title="AutoMod" />
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput value={autoModName} onChange={(event) => setAutoModName(event.target.value)} placeholder="Nome da regra" />
              <SelectInput value={autoModTrigger} onChange={(event) => setAutoModTrigger(event.target.value)}>
                <option value="BLOCKED_WORD">Palavras proibidas</option>
                <option value="SUSPICIOUS_LINK">Links suspeitos</option>
                <option value="SPAM">Spam repetitivo</option>
                <option value="FLOOD">Flood</option>
                <option value="CAPS_LOCK">Caps lock</option>
              </SelectInput>
            </div>
            <TextInput value={autoModKeywords} onChange={(event) => setAutoModKeywords(event.target.value)} placeholder="palavra1, palavra2" />
            <PrimaryButton
              disabled={!capabilities?.canManageGuild || loading || !autoModName}
              onClick={() =>
                void run(
                  () =>
                    createAutoModRule(guild.id, {
                      name: autoModName,
                      triggerType: autoModTrigger as any,
                      actionType: "WARN",
                      keywords: autoModKeywords.split(","),
                    }),
                  "Regra AutoMod criada.",
                )
              }
            >
              <Plus size={15} />
              Criar regra
            </PrimaryButton>
            <div className="space-y-2">
              {(extras?.autoModRules ?? []).slice(0, 6).map((rule: any) => (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => void run(() => toggleAutoModRule(rule.id, !rule.enabled), "Regra atualizada.")}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm dark:border-white/10"
                >
                  <span className="min-w-0 truncate">{rule.name}</span>
                  <span className={rule.enabled ? "text-emerald-500" : "text-zinc-500"}>{rule.enabled ? "Ativa" : "Pausada"}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Gauge size={15} />} title="Warnings e timeouts" />
          <div className="mt-4 space-y-3">
            <SelectInput value={moderationMemberId} onChange={(event) => setModerationMemberId(event.target.value)}>
              <option value="">Selecionar membro</option>
              {manageableMembers.map((member: any) => (
                <option key={member.id} value={member.id}>{displayName(member.user)}</option>
              ))}
            </SelectInput>
            <TextInput value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} placeholder="Motivo" />
            <div className="flex flex-wrap gap-2">
              <SecondaryButton
                disabled={!capabilities?.canModerateMembers || loading || !moderationMemberId}
                onClick={() => void run(() => createModerationWarning(moderationMemberId, moderationReason), "Advertência registrada.")}
              >
                Advertir
              </SecondaryButton>
              <DangerButton
                disabled={!capabilities?.canModerateMembers || loading || !moderationMemberId}
                onClick={() => void run(() => timeoutGuildMember(moderationMemberId, 3600, moderationReason), "Timeout aplicado.")}
              >
                Timeout 1h
              </DangerButton>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Smile size={15} />} title="Stickers e soundboard" />
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput value={stickerName} onChange={(event) => setStickerName(event.target.value)} placeholder="Nome do sticker" />
              <TextInput value={stickerUrl} onChange={(event) => setStickerUrl(event.target.value)} placeholder="URL ou key da imagem" />
            </div>
            <PrimaryButton disabled={!capabilities?.canManageExpressions || loading || !stickerName || !stickerUrl} onClick={() => void run(() => createGuildSticker(guild.id, { name: stickerName, url: stickerUrl }), "Sticker criado.")}>
              Criar sticker
            </PrimaryButton>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput value={soundName} onChange={(event) => setSoundName(event.target.value)} placeholder="Nome do som" />
              <TextInput value={soundUrl} onChange={(event) => setSoundUrl(event.target.value)} placeholder="URL ou key do áudio" />
            </div>
            <PrimaryButton disabled={!capabilities?.canManageExpressions || loading || !soundName || !soundUrl} onClick={() => void run(() => createSoundboardSound(guild.id, { name: soundName, url: soundUrl }), "Som criado.")}>
              Criar som
            </PrimaryButton>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={<Blocks size={15} />} title="Server templates" />
          <div className="mt-4 space-y-3">
            <TextInput value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nome do template" />
            <PrimaryButton disabled={!capabilities?.canManageGuild || loading || !templateName} onClick={() => void run(() => createServerTemplate(guild.id, { name: templateName, public: false }), "Template gerado.")}>
              <Copy size={15} />
              Gerar template
            </PrimaryButton>
            <div className="space-y-2">
              {(extras?.templates ?? []).slice(0, 5).map((template: any) => (
                <InfoLine key={template.id} label={template.name} value={template.code} mono copyable />
              ))}
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

function BansTab({ bans, loading, canManage, onUnban }: any) {
  if (!canManage && !loading) {
    return (
      <Gate
        allowed={false}
        loading={false}
        title="Sem acesso aos banimentos"
        description="Você precisa da permissão Banir Membros para visualizar e remover banimentos."
      >
        {null}
      </Gate>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<Ban size={22} />}
        title="Banimentos"
        description="Pessoas banidas não podem retornar enquanto o banimento estiver ativo."
      />

      <Card>
        {loading ? (
          <LoadingState />
        ) : bans.length === 0 ? (
          <EmptyState icon={<Ban size={28} />} title="Nenhum membro banido" description="Quando alguém for banido, aparecerá aqui." />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
            {bans.map((ban: any) => (
              <div key={ban.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-white/[0.05]">
                  {ban.user?.avatarUrl ? (
                    <Avatar avatarUrl={ban.user.avatarUrl} className="h-full w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-500"><Ban size={17} /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{displayName(ban.user)}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    @{ban.user?.username} · {formatDate(ban.createdAt)}
                  </div>
                  {ban.reason && <div className="mt-1 line-clamp-2 text-xs text-zinc-500">Motivo: {ban.reason}</div>}
                </div>
                <SecondaryButton onClick={() => onUnban(ban.userId)} disabled={loading}>
                  Remover ban
                </SecondaryButton>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function AuditTab({ logs, loading, canView }: any) {
  if (!canView && !loading) {
    return (
      <Gate
        allowed={false}
        loading={false}
        title="Registro de auditoria restrito"
        description="Você precisa da permissão Ver Registro de Auditoria para acessar esta área."
      >
        {null}
      </Gate>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<FileClock size={22} />}
        title="Registro de auditoria"
        description="As 100 ações administrativas mais recentes registradas pelo servidor."
      />

      <Card>
        {loading ? (
          <LoadingState />
        ) : logs.length === 0 ? (
          <EmptyState icon={<FileClock size={28} />} title="Nenhuma ação registrada" />
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
            {logs.map((entry: any) => (
              <div key={entry.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                  <FileClock size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold">{auditLabels[entry.action] ?? entry.action}</span>
                    <span className="text-xs text-zinc-500">por {entry.actor ? displayName(entry.actor) : "usuário removido"}</span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">{formatDate(entry.createdAt)}</div>
                  {entry.targetId && (
                    <div className="mt-1 truncate font-mono text-[10px] text-zinc-400">alvo: {entry.targetId}</div>
                  )}
                  {entry.metadata && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] font-semibold text-indigo-500 hover:text-indigo-400">Ver detalhes</summary>
                      <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-zinc-100 p-3 text-[10px] leading-4 text-zinc-700 dark:bg-black/25 dark:text-zinc-300">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

function AdvancedTab({
  guild,
  extras,
  ownerCandidates,
  newOwnerUserId,
  setNewOwnerUserId,
  confirmName,
  setConfirmName,
  loading,
  onTransfer,
  onLeave,
  onDelete,
}: any) {
  const isOwner = Boolean(extras?.isOwner);

  return (
    <section className="space-y-6">
      <PageHeader
        icon={<ShieldAlert size={22} />}
        title="Avançado"
        description="Informações de sistema e ações sensíveis relacionadas à propriedade do servidor."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle icon={<KeyRound size={16} />} title="Informações do sistema" />
          <div className="mt-4 space-y-3">
            <InfoLine label="ID do servidor" value={guild.id} mono copyable />
            <InfoLine label="Verificado" value={extras?.guild.verified ? "Sim" : "Não"} />
            <InfoLine label="URL personalizada" value={extras?.guild.vanityUrl || "Não configurada"} />
            <InfoLine label="Criado em" value={formatDate(extras?.guild.createdAt)} />
            <InfoLine label="Atualizado em" value={formatDate(extras?.guild.updatedAt)} />
          </div>
          <Callout type="info" title="Campo de sistema" className="mt-4">
            O status de verificação é informativo. Ele não é editável pelas configurações normais do servidor.
          </Callout>
        </Card>

        {isOwner ? (
          <Card>
            <SectionTitle icon={<Crown size={16} />} title="Transferir propriedade" />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              O novo dono ganha controle total do servidor. Você continuará como membro após a transferência.
            </p>
            <div className="mt-4 space-y-3">
              <SelectInput
                value={newOwnerUserId}
                onChange={(event) => setNewOwnerUserId(event.target.value)}
                disabled={loading}
              >
                <option value="">Selecione um membro</option>
                {ownerCandidates.map((member: any) => (
                  <option key={member.userId} value={member.userId}>
                    {displayName(member.user)} (@{member.user?.username})
                  </option>
                ))}
              </SelectInput>
              <PrimaryButton onClick={onTransfer} disabled={loading || !newOwnerUserId}>
                <Crown size={15} />
                Transferir propriedade
              </PrimaryButton>
            </div>
          </Card>
        ) : (
          <Card>
            <SectionTitle icon={<LogOut size={16} />} title="Sair do servidor" />
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              Você perderá acesso aos canais até entrar novamente por um convite válido.
            </p>
            <DangerButton className="mt-4" onClick={onLeave} disabled={loading}>
              <LogOut size={15} />
              Sair do servidor
            </DangerButton>
          </Card>
        )}
      </div>

      {isOwner && (
        <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-500/[0.025]">
          <SectionTitle icon={<Trash2 size={16} />} title="Zona de perigo" danger />
          <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
            <div>
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400">Excluir servidor permanentemente</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500">
                Canais, categorias, cargos, membros, mensagens, emojis, convites e bans relacionados ao servidor serão removidos pelas relações em cascata do schema. Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="space-y-3">
              <Field label={`Digite “${guild.name}” para confirmar`}>
                <TextInput
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  disabled={loading}
                />
              </Field>
              <DangerButton
                className="w-full justify-center"
                onClick={onDelete}
                disabled={loading || confirmName.trim() !== guild.name}
              >
                <Trash2 size={15} />
                Excluir servidor permanentemente
              </DangerButton>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}

function ChannelGroup({ name, channels }: { name: string; channels: any[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.07]">
      <div className="flex items-center gap-2 bg-zinc-50 px-3 py-2.5 dark:bg-white/[0.025]">
        <ChevronDown size={14} className="text-zinc-500" />
        <span className="text-xs font-black uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{name}</span>
      </div>
      <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
        {channels.map((channel) => <ChannelRow key={channel.id} channel={channel} />)}
      </div>
    </div>
  );
}

function ChannelRow({ channel }: { channel: any }) {
  const voice = channel.type === "GUILD_VOICE" || channel.type === "GUILD_VIDEO";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {voice ? <Volume2 size={15} className="shrink-0 text-zinc-500" /> : <Hash size={15} className="shrink-0 text-zinc-500" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{channel.name}</div>
        <div className="mt-0.5 text-[10px] text-zinc-500">
          {channel.type.replaceAll("_", " ")} · posição {channel.position}
        </div>
      </div>
      {channel.nsfw && (
        <span className="rounded-md bg-red-500/10 px-2 py-1 text-[9px] font-black uppercase text-red-500">NSFW</span>
      )}
    </div>
  );
}

function ModerationDialog({
  title,
  description,
  reason,
  setReason,
  loading,
  destructiveLabel,
  onClose,
  onConfirm,
}: any) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-zinc-500">{description}</p>
      <div className="mt-4">
        <Field label="Motivo" description="Opcional. Será salvo no registro de auditoria e no banimento quando aplicável.">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Digite um motivo..."
            className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214] dark:text-white"
          />
        </Field>
      </div>
      <DialogFooter>
        <SecondaryButton onClick={onClose} disabled={loading}>Cancelar</SecondaryButton>
        <DangerButton onClick={onConfirm} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
          {destructiveLabel}
        </DangerButton>
      </DialogFooter>
    </Dialog>
  );
}

function ConfirmDialog({ title, description, loading, confirmLabel, onClose, onConfirm }: any) {
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="text-sm leading-6 text-zinc-500">{description}</p>
      <DialogFooter>
        <SecondaryButton onClick={onClose} disabled={loading}>Cancelar</SecondaryButton>
        <DangerButton onClick={onConfirm} disabled={loading}>
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          {confirmLabel}
        </DangerButton>
      </DialogFooter>
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-[min(520px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#1e1f22] dark:text-white"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-white/[0.07]">{children}</div>;
}

function Gate({ allowed, loading, title, description, children }: any) {
  if (loading) return <LoadingState />;
  if (!allowed) {
    return (
      <div className="flex min-h-[440px] items-center justify-center">
        <EmptyState icon={<Lock size={30} />} title={title} description={description} />
      </div>
    );
  }
  return children;
}

function LoadingState() {
  return (
    <div className="flex min-h-56 items-center justify-center">
      <Loader2 size={24} className="animate-spin text-indigo-500" />
    </div>
  );
}

function Toast({ notice }: { notice: Notice }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[100200]">
      <div
        className={classNames(
          "flex max-w-[420px] items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold shadow-2xl dark:bg-[#1e1f22]",
          notice.type === "success"
            ? "border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
            : "border-red-500/25 text-red-700 dark:text-red-300",
        )}
      >
        {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        <span>{notice.text}</span>
      </div>
    </div>
  );
}

function PageHeader({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200 dark:bg-white/[0.04] dark:text-zinc-300 dark:ring-white/10">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">{description}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavButton({ active, icon, label, badge, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition",
        active
          ? "bg-zinc-200 text-zinc-950 dark:bg-white/[0.08] dark:text-white"
          : "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.055] dark:hover:text-white",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge !== undefined && (
        <span className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[9px] font-black text-zinc-500 dark:bg-white/[0.07]">{badge}</span>
      )}
    </button>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={classNames("rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-[#1e1f22]", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, danger = false }: { icon: ReactNode; title: string; danger?: boolean }) {
  return (
    <div className={classNames("flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em]", danger ? "text-red-500" : "text-zinc-500")}>
      {icon}
      {title}
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</span>
      {description && <span className="mt-1 block text-[10px] leading-4 text-zinc-500">{description}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={classNames(
        "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#111214] dark:text-white dark:placeholder:text-zinc-600",
        props.className,
      )}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={classNames(
        "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[#111214] dark:text-white",
        props.className,
      )}
    />
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214]">
      <Search size={15} className="shrink-0 text-zinc-500" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-600"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white">
          <X size={13} />
        </button>
      )}
    </label>
  );
}

function SwitchRow({ checked, onChange, title, description, disabled = false }: any) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.07] dark:hover:bg-white/[0.03]"
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs leading-5 text-zinc-500">{description}</div>
      </div>
      <div className={classNames("relative h-6 w-10 shrink-0 rounded-full transition", checked ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700")}>
        <span className={classNames("absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-5" : "left-1")} />
      </div>
    </button>
  );
}

function PermissionToggle({ label, checked, disabled, dangerous, onChange }: any) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.025]"
    >
      <span
        className={classNames(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
          checked
            ? dangerous
              ? "border-red-500 bg-red-500 text-white"
              : "border-indigo-500 bg-indigo-500 text-white"
            : "border-zinc-300 dark:border-zinc-600",
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className={classNames("min-w-0 flex-1 text-sm", dangerous && checked ? "font-bold text-red-600 dark:text-red-400" : "text-zinc-800 dark:text-zinc-200")}>
        {label}
      </span>
      {dangerous && <AlertTriangle size={14} className="shrink-0 text-red-500" />}
    </button>
  );
}

function PrimaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={classNames(
        "inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={classNames(
        "inline-flex h-10 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200 dark:hover:bg-white/[0.07]",
        className,
      )}
    >
      {children}
    </button>
  );
}

function DangerButton({ children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={classNames(
        "inline-flex h-10 items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 text-xs font-bold text-red-600 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400",
        className,
      )}
    >
      {children}
    </button>
  );
}

function DangerIconButton({ children, title, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      {...props}
      title={title}
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10"
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-white/[0.06] dark:bg-white/[0.025]">
      <div className="text-lg font-black text-zinc-950 dark:text-white">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

function InfoLine({ label, value, mono = false, copyable = false }: { label: string; value: string; mono?: boolean; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be unavailable in non-secure contexts.
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={!copyable}
        className={classNames(
          "min-w-0 truncate text-right text-zinc-700 disabled:cursor-default dark:text-zinc-300",
          mono && "font-mono text-[10px]",
          copyable && "hover:text-indigo-500",
        )}
      >
        {copied ? "Copiado" : value}
      </button>
    </div>
  );
}

function Callout({ type, title, children, className }: { type: "info" | "danger"; title: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border px-4 py-3",
        type === "danger"
          ? "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
          : "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs font-black">
        {type === "danger" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        {title}
      </div>
      <div className="mt-1 text-[11px] leading-5 opacity-90">{children}</div>
    </div>
  );
}

function EmptyState({ icon, title, description, compact = false }: { icon: ReactNode; title: string; description?: string; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className={classNames("mx-auto flex items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-white/[0.05]", compact ? "h-11 w-11" : "h-14 w-14")}>
        {icon}
      </div>
      <h3 className={classNames("font-bold", compact ? "mt-3 text-sm" : "mt-4 text-base")}>{title}</h3>
      {description && <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>}
    </div>
  );
}

function tabTitle(tab: Tab) {
  const labels: Record<Tab, string> = {
    overview: "Visão geral",
    roles: "Cargos e permissões",
    members: "Membros",
    channels: "Canais e categorias",
    invites: "Convites",
    emojis: "Emojis",
    bans: "Banimentos",
    audit: "Registro de auditoria",
    production: "Produção",
    advanced: "Avançado",
  };
  return labels[tab];
}

function tabSubtitle(tab: Tab) {
  const labels: Record<Tab, string> = {
    overview: "Identidade e informações do servidor",
    roles: "Hierarquia e bitfields de permissões",
    members: "Cargos, apelidos e moderação",
    channels: "Estrutura do servidor",
    invites: "Links de acesso ao servidor",
    emojis: "Expressões personalizadas",
    bans: "Controle de membros impedidos",
    audit: "Histórico administrativo",
    production: "Onboarding, eventos, AutoMod e recursos avançados",
    advanced: "Propriedade e ações sensíveis",
  };
  return labels[tab];
}
