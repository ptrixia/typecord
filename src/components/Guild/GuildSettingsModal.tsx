"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  Copy,
  RefreshCw,
} from "lucide-react";

import {
  createGuildInvite,
  deleteGuildInvite,
  getGuildInvites,
} from "@/actions/invites";

import {
  X,
  ImagePlus,
  Shield,
  Users,
  Settings2,
  Trash2,
  Plus,
  Loader2,
  Check,
  Search,
  ChevronRight,
  ChevronDown,
  Save,
  Palette,
  Eye,
  AtSign,
  Lock,
  Crown,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

import { useRouter } from "next/navigation";

import { updateGuildSettings } from "@/actions/guilds";
import {
  createRole,
  updateRole,
  deleteRole,
} from "@/actions/roles";

import { toggleMemberRole } from "@/actions/members";

import {
  Permissions,
  PERMISSION_LABELS,
  type PermissionName,
} from "@/lib/permissions";
import InvitesSettings from "./InviteSettings";

type Tab =
  | "overview"
  | "roles"
  | "members" 
  | "invites";

type RoleDraft = {
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
  permissions: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  guild: any;
};

const permissionGroups: {
  title: string;
  description: string;
  permissions: PermissionName[];
}[] = [
  {
    title: "Geral do servidor",
    description:
      "Permissões administrativas e de gerenciamento do servidor.",
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
    title: "Membros",
    description:
      "Controle de membros e moderação.",
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
    description:
      "Gerenciamento da hierarquia e cargos.",
    permissions: [
      "MANAGE_ROLES",
    ],
  },

  {
    title: "Canais",
    description:
      "Controle sobre canais e estrutura do servidor.",
    permissions: [
      "MANAGE_CHANNELS",
      "VIEW_CHANNEL",
    ],
  },

  {
    title: "Mensagens",
    description:
      "Permissões relacionadas a mensagens.",
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
    description:
      "Controle de threads públicas e privadas.",
    permissions: [
      "MANAGE_THREADS",
      "CREATE_PUBLIC_THREADS",
      "CREATE_PRIVATE_THREADS",
    ],
  },

  {
    title: "Expressões",
    description:
      "Emojis, figurinhas e outras expressões.",
    permissions: [
      "MANAGE_EXPRESSIONS",
      "CREATE_GUILD_EXPRESSIONS",
      "USE_EXTERNAL_EMOJIS",
      "USE_EXTERNAL_STICKERS",
    ],
  },

  {
    title: "Voz e vídeo",
    description:
      "Permissões para canais de voz.",
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
    description:
      "Comandos, aplicativos e atividades.",
    permissions: [
      "USE_APPLICATION_COMMANDS",
      "USE_EMBEDDED_ACTIVITIES",
      "USE_EXTERNAL_APPS",
    ],
  },
];

export default function GuildSettingsModal({
  isOpen,
  onClose,
  guild,
}: Props) {
  const router = useRouter();

  const [tab, setTab] =
    useState<Tab>("overview");

  const [loading, setLoading] =
    useState(false);

  const [selected, setSelected] =
    useState<string | null>(null);

  const [memberSelected, setMemberSelected] =
    useState<any>(null);

  const [memberSearch, setMemberSearch] =
    useState("");

  const [roleSearch, setRoleSearch] =
    useState("");

  const [permissionSearch, setPermissionSearch] =
    useState("");

  const [name, setName] =
    useState("");

  const [icon, setIcon] =
    useState("");

  const [banner, setBanner] =
    useState("");

  const [createOpen, setCreateOpen] =
    useState(false);

  const [expandedGroups, setExpandedGroups] =
    useState<Record<string, boolean>>(
      Object.fromEntries(
        permissionGroups.map((group) => [
          group.title,
          true,
        ]),
      ),
    );

  const [notice, setNotice] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

  const [newRole, setNewRole] =
    useState<RoleDraft>({
      name: "Novo Cargo",
      color: "#5865F2",
      hoist: false,
      mentionable: false,
      permissions: "0",
    });

  const [roleDrafts, setRoleDrafts] =
    useState<Record<string, RoleDraft>>({});

  const iconRef =
    useRef<HTMLInputElement>(null);

  const bannerRef =
    useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!guild) return;

    setName(guild.name ?? "");
    setIcon(guild.iconUrl ?? "");
    setBanner(guild.bannerUrl ?? "");
  }, [guild]);

  const roles = useMemo(() => {
    return [...(guild?.roles ?? [])].sort(
      (a: any, b: any) =>
        b.position - a.position,
    );
  }, [guild]);

  const filteredRoles = useMemo(() => {
    const query =
      roleSearch.trim().toLowerCase();

    if (!query) return roles;

    return roles.filter((role: any) =>
      role.name
        .toLowerCase()
        .includes(query),
    );
  }, [roles, roleSearch]);

  const currentRole =
    roles.find(
      (role: any) =>
        role.id === selected,
    ) ?? null;

  const currentDraft =
    currentRole
      ? roleDrafts[currentRole.id] ??
        {
          name: currentRole.name,
          color:
            currentRole.color ??
            "#99aab5",
          hoist:
            !!currentRole.hoist,
          mentionable:
            !!currentRole.mentionable,
          permissions:
            currentRole.permissions ??
            "0",
        }
      : null;

  const filteredMembers = useMemo(() => {
    const query =
      memberSearch
        .trim()
        .toLowerCase();

    if (!query) {
      return guild?.members ?? [];
    }

    return (guild?.members ?? []).filter(
      (member: any) => {
        const username =
          member.user?.username
            ?.toLowerCase() ?? "";

        const globalName =
          member.user?.globalName
            ?.toLowerCase() ?? "";

        return (
          username.includes(query) ||
          globalName.includes(query)
        );
      },
    );
  }, [guild, memberSearch]);

  if (!isOpen) return null;

  function showNotice(
    type: "success" | "error",
    text: string,
  ) {
    setNotice({
      type,
      text,
    });

    window.setTimeout(() => {
      setNotice(null);
    }, 3500);
  }

  function updateDraft(
    patch: Partial<RoleDraft>,
  ) {
    if (!currentRole) return;

    setRoleDrafts((previous) => ({
      ...previous,

      [currentRole.id]: {
        ...(previous[currentRole.id] ??
          {
            name: currentRole.name,
            color:
              currentRole.color ??
              "#99aab5",
            hoist:
              !!currentRole.hoist,
            mentionable:
              !!currentRole.mentionable,
            permissions:
              currentRole.permissions ??
              "0",
          }),

        ...patch,
      },
    }));
  }

  function getPermissionState(
    permission: PermissionName,
  ) {
    if (!currentDraft) return false;

    const bits = BigInt(
      currentDraft.permissions || "0",
    );

    return (
      (bits & Permissions[permission]) ===
        Permissions[permission] ||
      (bits &
        Permissions.ADMINISTRATOR) !==
        0n
    );
  }

  function togglePermission(
    permission: PermissionName,
    enabled: boolean,
  ) {
    if (!currentDraft) return;

    let bits = BigInt(
      currentDraft.permissions || "0",
    );

    const value =
      Permissions[permission];

    if (enabled) {
      bits |= value;
    } else {
      bits &= ~value;

      if (
        permission ===
        "ADMINISTRATOR"
      ) {
        bits &= ~Permissions.ADMINISTRATOR;
      }
    }

    updateDraft({
      permissions:
        bits.toString(),
    });
  }

  async function upload(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: "icon" | "banner",
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith("image/")
    ) {
      showNotice(
        "error",
        "Selecione uma imagem válida.",
      );

      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      showNotice(
        "error",
        "O arquivo precisa ter no máximo 10 MB.",
      );

      return;
    }

    setLoading(true);

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file,
      );

      const response =
        await fetch(
          "/api/upload",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.url
      ) {
        throw new Error(
          data.error ??
            "Falha no upload.",
        );
      }

      if (kind === "icon") {
        setIcon(data.url);
      } else {
        setBanner(data.url);
      }

      showNotice(
        "success",
        "Imagem carregada.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Falha no upload.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveOverview() {
    if (!name.trim()) {
      showNotice(
        "error",
        "Digite um nome para o servidor.",
      );

      return;
    }

    setLoading(true);

    try {
      await updateGuildSettings(
        guild.id,
        {
          name: name.trim(),
          iconUrl: icon,
          bannerUrl: banner,
        },
      );

      router.refresh();

      showNotice(
        "success",
        "Configurações salvas.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Não foi possível salvar.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveRole() {
    if (
      !currentRole ||
      !currentDraft
    ) {
      return;
    }

    if (
      currentRole.isDefault
    ) {
      return;
    }

    if (!currentDraft.name.trim()) {
      showNotice(
        "error",
        "O cargo precisa ter um nome.",
      );

      return;
    }

    setLoading(true);

    try {
      await updateRole(
        currentRole.id,
        {
          name:
            currentDraft.name.trim(),
          color:
            currentDraft.color,
          hoist:
            currentDraft.hoist,
          mentionable:
            currentDraft.mentionable,
          permissions:
            currentDraft.permissions,
          position:
            currentRole.position,
        },
      );

      router.refresh();

      showNotice(
        "success",
        "Cargo atualizado.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Não foi possível atualizar o cargo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    if (!newRole.name.trim()) {
      showNotice(
        "error",
        "Digite um nome para o cargo.",
      );

      return;
    }

    setLoading(true);

    try {
      const role =
        await createRole(
          guild.id,
          {
            ...newRole,
            name:
              newRole.name.trim(),
          },
        );

      setCreateOpen(false);

      setSelected(role.id);

      router.refresh();

      showNotice(
        "success",
        "Cargo criado com sucesso.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Não foi possível criar o cargo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeRole() {
    if (
      !currentRole ||
      currentRole.isDefault ||
      currentRole.managed
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Tem certeza que deseja excluir o cargo "${currentRole.name}"?`,
      );

    if (!confirmed) return;

    setLoading(true);

    try {
      await deleteRole(
        currentRole.id,
      );

      setSelected(null);

      router.refresh();

      showNotice(
        "success",
        "Cargo excluído.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Não foi possível excluir o cargo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleMember(
    member: any,
    role: any,
  ) {
    const hasRole =
      member.roles?.some(
        (item: any) =>
          item.id === role.id,
      );

    try {
      await toggleMemberRole(
        member.id,
        role.id,
      );

      setMemberSelected({
        ...member,
        roles: hasRole
          ? member.roles.filter(
              (item: any) =>
                item.id !== role.id,
            )
          : [
              ...(member.roles ?? []),
              role,
            ],
      });

      router.refresh();

      showNotice(
        "success",
        hasRole
          ? "Cargo removido."
          : "Cargo atribuído.",
      );
    } catch (error: any) {
      showNotice(
        "error",
        error.message ??
          "Não foi possível alterar o cargo.",
      );
    }
  }

  function toggleGroup(
    title: string,
  ) {
    setExpandedGroups(
      (previous) => ({
        ...previous,
        [title]:
          !previous[title],
      }),
    );
  }

  return (
    <div className="fixed inset-0 z-[99999] flex bg-[#f5f6f8] text-[#1e1f22] dark:bg-[#111214] dark:text-white">
      {/* UPLOAD INPUTS */}

      <input
        ref={iconRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) =>
          upload(event, "icon")
        }
      />

      <input
        ref={bannerRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) =>
          upload(event, "banner")
        }
      />

      {/* NOTIFICATION */}

      {notice && (
        <div className="fixed right-6 top-6 z-[100010]">
          <div
            className={`flex min-w-[300px] items-center gap-3 rounded-lg border px-4 py-3 shadow-2xl ${
              notice.type ===
              "success"
                ? "border-emerald-500/20 bg-white dark:bg-[#1e1f22]"
                : "border-red-500/20 bg-white dark:bg-[#1e1f22]"
            }`}
          >
            {notice.type ===
            "success" ? (
              <CheckCircle2
                size={18}
                className="text-emerald-500"
              />
            ) : (
              <AlertTriangle
                size={18}
                className="text-red-500"
              />
            )}

            <span className="text-sm font-medium">
              {notice.text}
            </span>
          </div>
        </div>
      )}

      {/* SIDEBAR */}

      <aside className="hidden w-[280px] shrink-0 border-r border-black/5 bg-[#f2f3f5] dark:border-white/5 dark:bg-[#111214] md:flex md:flex-col">
        <div className="border-b border-black/5 px-6 py-6 dark:border-white/5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Configurações do servidor
          </div>

          <div className="mt-1 truncate text-base font-semibold">
            {guild.name}
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <SidebarButton
            active={tab === "overview"}
            icon={<Settings2 size={18} />}
            label="Visão geral"
            onClick={() => {
              setTab("overview");
              setSelected(null);
              setMemberSelected(null);
            }}
          />

          <div className="px-3 pb-2 pt-6 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Comunidade
          </div>

          <SidebarButton
            active={tab === "roles"}
            icon={<Shield size={18} />}
            label="Cargos"
            onClick={() => {
              setTab("roles");
              setMemberSelected(null);
            }}
            badge={roles.length}
          />

          <SidebarButton
            active={tab === "members"}
            icon={<Users size={18} />}
            label="Membros"
            onClick={() => {
              setTab("members");
              setSelected(null);
            }}
            badge={
              guild.members?.length ??
              0
            }
          />
          <button
  onClick={() => {
    setTab("invites");
    setSelected(null);
    setMemberSelected(null);
  }}
  className={`mb-1 flex w-full items-center gap-3 rounded px-3 py-2 text-sm ${
    tab === "invites"
      ? "bg-zinc-200 dark:bg-zinc-800"
      : "text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-900"
  }`}
>
  <Link size={16} />
  Convites
</button>
        </nav>

        <div className="border-t border-black/5 p-4 dark:border-white/5">
          <button
            onClick={onClose}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <X size={18} />
            Fechar configurações
          </button>
        </div>
      </aside>

      {/* CONTENT */}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <button
          onClick={onClose}
          className="fixed right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-zinc-500 shadow-sm transition hover:bg-zinc-100 hover:text-zinc-900 dark:border-white/10 dark:bg-[#1e1f22] dark:hover:bg-[#2b2d31] dark:hover:text-white"
        >
          <X size={18} />
        </button>

        <div className="mx-auto w-full max-w-[1050px] px-6 py-16 md:px-10">
          {/* OVERVIEW */}

{tab === "invites" && (
  <InvitesSettings guild={guild} />
)}
          {tab === "overview" && (
            <section className="space-y-8">
              <PageHeader
                title="Visão geral"
                description="Configure a identidade visual e as informações básicas do seu servidor."
              />

              <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1f22]">
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#5865f2]/30 via-[#7289da]/10 to-transparent">
                  {banner && (
                    <img
                      src={banner}
                      className="absolute inset-0 h-full w-full object-cover"
                      alt=""
                    />
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

                  <button
                    onClick={() =>
                      bannerRef.current?.click()
                    }
                    className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/80"
                  >
                    <ImagePlus size={15} />
                    Alterar banner
                  </button>

                  <div className="absolute bottom-[-32px] left-6">
                    <button
                      onClick={() =>
                        iconRef.current?.click()
                      }
                      className="group relative h-24 w-24 overflow-hidden rounded-full border-[5px] border-white bg-[#5865f2] shadow-xl dark:border-[#1e1f22]"
                    >
                      {icon ? (
                        <img
                          src={icon}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        <ImagePlus
                          className="mx-auto text-white"
                          size={28}
                        />
                      )}

                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
                        <ImagePlus
                          size={20}
                          className="text-white"
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-12">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Field
                      label="Nome do servidor"
                      description="Escolha um nome fácil de reconhecer."
                    >
                      <input
                        value={name}
                        maxLength={100}
                        onChange={(event) =>
                          setName(
                            event.target.value,
                          )
                        }
                        className="h-11 w-full rounded-lg border border-black/10 bg-zinc-50 px-3 text-sm outline-none transition focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/20 dark:border-white/10 dark:bg-[#111214]"
                      />

                      <div className="mt-1 text-right text-[11px] text-zinc-500">
                        {name.length}/100
                      </div>
                    </Field>

                    <Field
                      label="Ícone"
                      description="PNG, JPG ou WebP de até 10 MB."
                    >
                      <button
                        onClick={() =>
                          iconRef.current?.click()
                        }
                        className="flex h-11 w-full items-center gap-3 rounded-lg border border-dashed border-black/10 bg-zinc-50 px-3 text-sm transition hover:border-[#5865f2] dark:border-white/10 dark:bg-[#111214]"
                      >
                        <ImagePlus
                          size={17}
                          className="text-zinc-500"
                        />

                        <span className="text-zinc-500">
                          Alterar ícone
                        </span>
                      </button>
                    </Field>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={loading}
                  onClick={saveOverview}
                  className="flex items-center gap-2 rounded-lg bg-[#5865f2] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  Salvar alterações
                </button>
              </div>
            </section>
          )}

          {/* ROLES */}

          {tab === "roles" && (
            <section>
              <PageHeader
                title="Cargos"
                description="Organize a hierarquia e defina exatamente o que cada cargo pode fazer."
                action={
                  <button
                    onClick={() =>
                      setCreateOpen(true)
                    }
                    className="flex items-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
                  >
                    <Plus size={17} />
                    Criar cargo
                  </button>
                }
              />

              <div className="mt-8 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1f22]">
                <div className="grid min-h-[650px] lg:grid-cols-[300px_1fr]">
                  {/* ROLE LIST */}

                  <div className="border-r border-black/5 dark:border-white/5">
                    <div className="border-b border-black/5 p-4 dark:border-white/5">
                      <div className="relative">
                        <Search
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />

                        <input
                          value={roleSearch}
                          onChange={(event) =>
                            setRoleSearch(
                              event.target.value,
                            )
                          }
                          placeholder="Pesquisar cargos"
                          className="h-10 w-full rounded-lg bg-zinc-100 pl-9 pr-3 text-sm outline-none dark:bg-[#111214]"
                        />
                      </div>
                    </div>

                    <div className="p-2">
                      {filteredRoles.map(
                        (role: any) => (
                          <button
                            key={role.id}
                            onClick={() =>
                              setSelected(
                                role.id,
                              )
                            }
                            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                              selected ===
                              role.id
                                ? "bg-[#5865f2]/10 text-[#5865f2] dark:bg-[#5865f2]/15"
                                : "hover:bg-black/5 dark:hover:bg-white/5"
                            }`}
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-full shadow-sm"
                              style={{
                                background:
                                  role.color ??
                                  "#99aab5",
                              }}
                            />

                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {role.name}
                            </span>

                            {role.isDefault && (
                              <span className="text-[9px] font-bold uppercase text-zinc-500">
                                padrão
                              </span>
                            )}

                            {role.managed && (
                              <Lock
                                size={13}
                                className="text-zinc-500"
                              />
                            )}

                            <ChevronRight
                              size={15}
                              className={`text-zinc-400 transition ${
                                selected ===
                                role.id
                                  ? "translate-x-0 opacity-100"
                                  : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                              }`}
                            />
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  {/* ROLE EDITOR */}

                  {currentRole &&
                  currentDraft ? (
                    <div className="min-w-0">
                      <div className="border-b border-black/5 px-6 py-5 dark:border-white/5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm"
                              style={{
                                background:
                                  currentDraft.color,
                              }}
                            >
                              <Shield
                                size={20}
                              />
                            </div>

                            <div>
                              <h3 className="font-semibold">
                                {currentRole.name}
                              </h3>

                              <p className="text-xs text-zinc-500">
                                Posição #
                                {
                                  currentRole.position
                                }
                              </p>
                            </div>
                          </div>

                          {!currentRole.isDefault &&
                            !currentRole.managed && (
                              <button
                                disabled={
                                  loading
                                }
                                onClick={
                                  removeRole
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                                title="Excluir cargo"
                              >
                                <Trash2
                                  size={17}
                                />
                              </button>
                            )}
                        </div>
                      </div>

                      <div className="space-y-8 p-6">
                        {/* BASIC */}

                        <div>
                          <SectionTitle>
                            Informações do cargo
                          </SectionTitle>

                          <div className="grid gap-5 md:grid-cols-2">
                            <Field label="Nome">
                              <input
                                disabled={
                                  currentRole.isDefault ||
                                  currentRole.managed
                                }
                                value={
                                  currentDraft.name
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateDraft(
                                    {
                                      name: event
                                        .target
                                        .value,
                                    },
                                  )
                                }
                                className="h-11 w-full rounded-lg border border-black/10 bg-zinc-50 px-3 text-sm outline-none transition focus:border-[#5865f2] dark:border-white/10 dark:bg-[#111214] disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </Field>

                            <Field label="Cor">
                              <div className="flex h-11 items-center gap-3 rounded-lg border border-black/10 bg-zinc-50 px-3 dark:border-white/10 dark:bg-[#111214]">
                                <input
                                  disabled={
                                    currentRole.isDefault ||
                                    currentRole.managed
                                  }
                                  type="color"
                                  value={
                                    currentDraft.color
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateDraft(
                                      {
                                        color:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent disabled:cursor-not-allowed"
                                />

                                <span className="font-mono text-xs uppercase text-zinc-500">
                                  {
                                    currentDraft.color
                                  }
                                </span>
                              </div>
                            </Field>
                          </div>
                        </div>

                        {/* OPTIONS */}

                        <div>
                          <SectionTitle>
                            Exibição
                          </SectionTitle>

                          <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5 dark:divide-white/5 dark:border-white/5">
                            <RoleOption
                              icon={
                                <Users
                                  size={18}
                                />
                              }
                              title="Exibir separadamente"
                              description="Mostra membros com este cargo em uma categoria separada na lista."
                              checked={
                                currentDraft.hoist
                              }
                              disabled={
                                currentRole.isDefault ||
                                currentRole.managed
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  {
                                    hoist:
                                      value,
                                  },
                                )
                              }
                            />

                            <RoleOption
                              icon={
                                <AtSign
                                  size={18}
                                />
                              }
                              title="Permitir mencionar este cargo"
                              description="Membros poderão mencionar este cargo."
                              checked={
                                currentDraft.mentionable
                              }
                              disabled={
                                currentRole.isDefault ||
                                currentRole.managed
                              }
                              onChange={(
                                value,
                              ) =>
                                updateDraft(
                                  {
                                    mentionable:
                                      value,
                                  },
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* PERMISSIONS */}

                        <div>
                          <div className="mb-4 flex items-center justify-between gap-4">
                            <div>
                              <SectionTitle>
                                Permissões
                              </SectionTitle>

                              <p className="mt-1 text-xs text-zinc-500">
                                Defina o que os membros com este cargo podem fazer.
                              </p>
                            </div>

                            <div className="relative">
                              <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                              />

                              <input
                                value={
                                  permissionSearch
                                }
                                onChange={(
                                  event,
                                ) =>
                                  setPermissionSearch(
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                placeholder="Pesquisar"
                                className="h-9 w-44 rounded-lg bg-zinc-100 pl-9 pr-3 text-xs outline-none dark:bg-[#111214]"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            {permissionGroups.map(
                              (group) => {
                                const visible =
                                  group.permissions.filter(
                                    (permission) =>
                                      !permissionSearch.trim() ||
                                      PERMISSION_LABELS[
                                        permission
                                      ]
                                        .toLowerCase()
                                        .includes(
                                          permissionSearch
                                            .toLowerCase(),
                                        ),
                                  );

                                if (
                                  !visible.length
                                ) {
                                  return null;
                                }

                                const expanded =
                                  expandedGroups[
                                    group.title
                                  ];

                                return (
                                  <div
                                    key={
                                      group.title
                                    }
                                    className="overflow-hidden rounded-xl border border-black/5 dark:border-white/5"
                                  >
                                    <button
                                      onClick={() =>
                                        toggleGroup(
                                          group.title,
                                        )
                                      }
                                      className="flex w-full items-center gap-3 bg-zinc-50 px-4 py-3 text-left transition hover:bg-zinc-100 dark:bg-[#18191c] dark:hover:bg-[#202225]"
                                    >
                                      {expanded ? (
                                        <ChevronDown
                                          size={
                                            16
                                          }
                                        />
                                      ) : (
                                        <ChevronRight
                                          size={
                                            16
                                          }
                                        />
                                      )}

                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-semibold">
                                          {
                                            group.title
                                          }
                                        </div>

                                        <div className="text-[11px] text-zinc-500">
                                          {
                                            group.description
                                          }
                                        </div>
                                      </div>
                                    </button>

                                    {expanded && (
                                      <div className="divide-y divide-black/5 dark:divide-white/5">
                                        {visible.map(
                                          (
                                            permission,
                                          ) => {
                                            const checked =
                                              getPermissionState(
                                                permission,
                                              );

                                            return (
                                              <PermissionRow
                                                key={
                                                  permission
                                                }
                                                label={
                                                  PERMISSION_LABELS[
                                                    permission
                                                  ]
                                                }
                                                checked={
                                                  checked
                                                }
                                                disabled={
                                                  currentRole.isDefault ||
                                                  currentRole.managed
                                                }
                                                onChange={(
                                                  value,
                                                ) =>
                                                  togglePermission(
                                                    permission,
                                                    value,
                                                  )
                                                }
                                              />
                                            );
                                          },
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>

                        {/* SAVE */}

                        {!currentRole.isDefault &&
                          !currentRole.managed && (
                            <div className="flex items-center justify-between rounded-xl border border-[#5865f2]/20 bg-[#5865f2]/5 p-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5865f2]/10 text-[#5865f2]">
                                  <Shield
                                    size={15}
                                  />
                                </div>

                                <span className="text-xs text-zinc-500">
                                  Alterações de permissões entram em vigor imediatamente.
                                </span>
                              </div>

                              <button
                                disabled={
                                  loading
                                }
                                onClick={
                                  saveRole
                                }
                                className="flex items-center gap-2 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-50"
                              >
                                {loading ? (
                                  <Loader2
                                    size={
                                      15
                                    }
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Save
                                    size={
                                      15
                                    }
                                  />
                                )}

                                Salvar
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[650px] items-center justify-center">
                      <div className="max-w-xs text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865f2]/10 text-[#5865f2]">
                          <Shield size={26} />
                        </div>

                        <h3 className="font-semibold">
                          Selecione um cargo
                        </h3>

                        <p className="mt-2 text-sm text-zinc-500">
                          Escolha um cargo na lista para editar suas informações e permissões.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* MEMBERS */}

          {tab === "members" && (
            <section>
              <PageHeader
                title="Membros"
                description="Gerencie os cargos atribuídos aos membros do servidor."
              />

              <div className="mt-8 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm dark:border-white/5 dark:bg-[#1e1f22]">
                {!memberSelected ? (
                  <>
                    <div className="border-b border-black/5 p-4 dark:border-white/5">
                      <div className="relative max-w-md">
                        <Search
                          size={17}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                        />

                        <input
                          value={
                            memberSearch
                          }
                          onChange={(
                            event,
                          ) =>
                            setMemberSearch(
                              event.target
                                .value,
                            )
                          }
                          placeholder="Pesquisar membros"
                          className="h-11 w-full rounded-lg bg-zinc-100 pl-10 pr-3 text-sm outline-none dark:bg-[#111214]"
                        />
                      </div>
                    </div>

                    <div className="divide-y divide-black/5 dark:divide-white/5">
                      {filteredMembers.map(
                        (member: any) => (
                          <button
                            key={
                              member.id
                            }
                            onClick={() =>
                              setMemberSelected(
                                member,
                              )
                            }
                            className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                          >
                            <img
                              src={
                                member.user
                                  ?.avatarUrl ||
                                "https://placehold.co/100"
                              }
                              className="h-10 w-10 rounded-full object-cover"
                              alt=""
                            />

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">
                                {member
                                  .user
                                  ?.globalName ||
                                  member
                                    .user
                                    ?.username ||
                                  "Usuário"}
                              </div>

                              <div className="truncate text-xs text-zinc-500">
                                @
                                {member
                                  .user
                                  ?.username ||
                                  "unknown"}
                              </div>
                            </div>

                            <div className="hidden items-center gap-1.5 sm:flex">
                              {(member.roles ??
                                [])
                                .filter(
                                  (
                                    role: any,
                                  ) =>
                                    !role.isDefault,
                                )
                                .slice(0, 3)
                                .map(
                                  (
                                    role: any,
                                  ) => (
                                    <span
                                      key={
                                        role.id
                                      }
                                      className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-medium dark:bg-[#111214]"
                                      style={{
                                        color:
                                          role.color,
                                      }}
                                    >
                                      {
                                        role.name
                                      }
                                    </span>
                                  ),
                                )}
                            </div>

                            <ChevronRight
                              size={17}
                              className="text-zinc-400"
                            />
                          </button>
                        ),
                      )}

                      {!filteredMembers.length && (
                        <div className="p-12 text-center text-sm text-zinc-500">
                          Nenhum membro encontrado.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="border-b border-black/5 px-5 py-4 dark:border-white/5">
                      <button
                        onClick={() =>
                          setMemberSelected(
                            null,
                          )
                        }
                        className="text-xs font-semibold text-[#5865f2] hover:underline"
                      >
                        ← Voltar para membros
                      </button>
                    </div>

                    <div className="border-b border-black/5 px-6 py-6 dark:border-white/5">
                      <div className="flex items-center gap-4">
                        <img
                          src={
                            memberSelected
                              .user
                              ?.avatarUrl ||
                            "https://placehold.co/100"
                          }
                          className="h-16 w-16 rounded-full object-cover"
                          alt=""
                        />

                        <div>
                          <h3 className="text-lg font-semibold">
                            {memberSelected
                              .user
                              ?.globalName ||
                              memberSelected
                                .user
                                ?.username ||
                              "Usuário"}
                          </h3>

                          <p className="text-sm text-zinc-500">
                            @
                            {memberSelected
                              .user
                              ?.username ||
                              "unknown"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="mb-4">
                        <h4 className="font-semibold">
                          Cargos
                        </h4>

                        <p className="mt-1 text-xs text-zinc-500">
                          Escolha os cargos que este membro possui.
                        </p>
                      </div>

                      <div className="overflow-hidden rounded-xl border border-black/5 dark:border-white/5">
                        {roles
                          .filter(
                            (
                              role: any,
                            ) =>
                              !role.isDefault &&
                              !role.managed,
                          )
                          .map(
                            (role: any) => {
                              const has =
                                memberSelected.roles?.some(
                                  (
                                    item: any,
                                  ) =>
                                    item.id ===
                                    role.id,
                                );

                              return (
                                <button
                                  key={
                                    role.id
                                  }
                                  onClick={() =>
                                    toggleMember(
                                      memberSelected,
                                      role,
                                    )
                                  }
                                  className="flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition last:border-0 hover:bg-black/[0.03] dark:border-white/5 dark:hover:bg-white/[0.03]"
                                >
                                  <span
                                    className="h-3 w-3 rounded-full"
                                    style={{
                                      background:
                                        role.color ??
                                        "#99aab5",
                                    }}
                                  />

                                  <span className="flex-1 text-sm font-medium">
                                    {
                                      role.name
                                    }
                                  </span>

                                  {has && (
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#5865f2] text-white">
                                      <Check
                                        size={
                                          14
                                        }
                                      />
                                    </span>
                                  )}
                                </button>
                              );
                            },
                          )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* CREATE ROLE */}

      {createOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#1e1f22]">
            <div className="border-b border-black/5 px-6 py-5 dark:border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">
                    Criar cargo
                  </h3>

                  <p className="mt-1 text-xs text-zinc-500">
                    Crie um novo nível de acesso para seu servidor.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setCreateOpen(false)
                  }
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              <Field label="Nome do cargo">
                <input
                  autoFocus
                  value={newRole.name}
                  onChange={(event) =>
                    setNewRole(
                      (previous) => ({
                        ...previous,
                        name: event.target
                          .value,
                      }),
                    )
                  }
                  placeholder="Ex.: Moderador"
                  className="h-11 w-full rounded-lg border border-black/10 bg-zinc-50 px-3 text-sm outline-none focus:border-[#5865f2] dark:border-white/10 dark:bg-[#111214]"
                />
              </Field>

              <Field label="Cor do cargo">
                <div className="flex h-12 items-center gap-3 rounded-lg border border-black/10 bg-zinc-50 px-3 dark:border-white/10 dark:bg-[#111214]">
                  <input
                    type="color"
                    value={
                      newRole.color
                    }
                    onChange={(event) =>
                      setNewRole(
                        (previous) => ({
                          ...previous,
                          color:
                            event.target
                              .value,
                        }),
                      )
                    }
                    className="h-8 w-10 cursor-pointer rounded bg-transparent"
                  />

                  <span
                    className="font-mono text-sm font-semibold"
                    style={{
                      color:
                        newRole.color,
                    }}
                  >
                    {newRole.color.toUpperCase()}
                  </span>
                </div>
              </Field>

              <div className="rounded-xl border border-black/5 dark:border-white/5">
                <RoleOption
                  icon={
                    <Users size={18} />
                  }
                  title="Exibir separadamente"
                  description="Mostra membros com este cargo separados."
                  checked={
                    newRole.hoist
                  }
                  onChange={(value) =>
                    setNewRole(
                      (previous) => ({
                        ...previous,
                        hoist: value,
                      }),
                    )
                  }
                />

                <RoleOption
                  icon={
                    <AtSign size={18} />
                  }
                  title="Mencionável"
                  description="Permite que membros mencionem este cargo."
                  checked={
                    newRole.mentionable
                  }
                  onChange={(value) =>
                    setNewRole(
                      (previous) => ({
                        ...previous,
                        mentionable:
                          value,
                      }),
                    )
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-black/5 px-6 py-4 dark:border-white/5">
              <button
                onClick={() =>
                  setCreateOpen(false)
                }
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/5"
              >
                Cancelar
              </button>

              <button
                disabled={loading}
                onClick={create}
                className="flex items-center gap-2 rounded-lg bg-[#5865f2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-50"
              >
                {loading && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                Criar cargo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- */
/* COMPONENTES AUXILIARES */
/* -------------------------------------------------- */

function SidebarButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-[#5865f2] text-white shadow-sm"
          : "text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/5 dark:hover:text-white"
      }`}
    >
      {icon}

      <span className="flex-1 text-left">
        {label}
      </span>

      {badge !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            active
              ? "bg-white/20 text-white"
              : "bg-black/5 text-zinc-500 dark:bg-white/5"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {title}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          {description}
        </p>
      </div>

      {action}
    </div>
  );
}

function SectionTitle({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-zinc-500">
      {children}
    </h3>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
        {label}
      </label>

      {description && (
        <p className="mb-2 mt-1 text-[11px] text-zinc-500">
          {description}
        </p>
      )}

      {children}
    </div>
  );
}

function RoleOption({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-center gap-4 p-4 text-left transition hover:bg-black/[0.025] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[0.025]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-[#111214]">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          {title}
        </div>

        <div className="mt-0.5 text-xs text-zinc-500">
          {description}
        </div>
      </div>

      <div
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${
          checked
            ? "bg-[#5865f2]"
            : "bg-zinc-300 dark:bg-[#4e5058]"
        }`}
      >
        <div
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked
              ? "left-5"
              : "left-1"
          }`}
        />
      </div>
    </button>
  );
}

function PermissionRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-black/[0.025] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[0.025]"
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          checked
            ? "border-[#5865f2] bg-[#5865f2] text-white"
            : "border-zinc-300 bg-transparent dark:border-zinc-600"
        }`}
      >
        {checked && (
          <Check size={13} strokeWidth={3} />
        )}
      </div>

      <span className="text-sm">
        {label}
      </span>
    </button>
  );
}