"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  CircleSlash2,
  Hash,
  Loader2,
  RotateCcw,
  Search,
  ShieldCheck,
  Volume2,
  X,
} from "lucide-react";

import { Permissions } from "@/lib/permissions";


type PermissionState = "inherit" | "allow" | "deny";
type SettingsTab = "general" | "permissions";

type CategorySummary = {
  id: string;
  name: string;
  position: number;
};

type RoleSummary = {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: string;
  isDefault: boolean;
  managed: boolean;
};

type OverwriteSummary = {
  id: string;
  roleId: string | null;
  allow: string;
  deny: string;
};

type PermissionDefinition = {
  key: keyof typeof Permissions;
  label: string;
  description: string;
  scope: "all" | "text" | "voice";
};

type PermissionDraft = {
  allow: bigint;
  deny: bigint;
};

interface ChannelSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: any | null;
  categories: CategorySummary[];
  onUpdated: (channel: any) => void;
}

const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "VIEW_CHANNEL",
    label: "Ver canal",
    description: "Permite visualizar e acessar este canal.",
    scope: "all",
  },
  {
    key: "MANAGE_CHANNELS",
    label: "Gerenciar canal",
    description: "Permite editar, mover e excluir este canal.",
    scope: "all",
  },
  {
    key: "MANAGE_ROLES",
    label: "Gerenciar permissões",
    description: "Permite alterar os permission overwrites deste canal.",
    scope: "all",
  },
  {
    key: "CREATE_INSTANT_INVITE",
    label: "Criar convite",
    description: "Permite criar convites apontando para este canal.",
    scope: "all",
  },
  {
    key: "SEND_MESSAGES",
    label: "Enviar mensagens",
    description: "Permite enviar mensagens no canal.",
    scope: "text",
  },
  {
    key: "ADD_REACTIONS",
    label: "Adicionar reações",
    description: "Permite adicionar novas reações às mensagens.",
    scope: "text",
  },
  {
    key: "EMBED_LINKS",
    label: "Incorporar links",
    description: "Permite que links enviados exibam prévias.",
    scope: "text",
  },
  {
    key: "ATTACH_FILES",
    label: "Anexar arquivos",
    description: "Permite enviar imagens, vídeos e outros arquivos.",
    scope: "text",
  },
  {
    key: "READ_MESSAGE_HISTORY",
    label: "Ler histórico",
    description: "Permite acessar mensagens enviadas anteriormente.",
    scope: "text",
  },
  {
    key: "MENTION_EVERYONE",
    label: "Mencionar @everyone",
    description: "Permite mencionar @everyone, @here e todos os cargos.",
    scope: "text",
  },
  {
    key: "USE_EXTERNAL_EMOJIS",
    label: "Usar emojis externos",
    description: "Permite usar emojis de outros servidores.",
    scope: "text",
  },
  {
    key: "MANAGE_MESSAGES",
    label: "Gerenciar mensagens",
    description: "Permite excluir e moderar mensagens de outras pessoas.",
    scope: "text",
  },
  {
    key: "USE_APPLICATION_COMMANDS",
    label: "Usar comandos",
    description: "Permite usar comandos de aplicativos e bots.",
    scope: "text",
  },
  {
    key: "CREATE_PUBLIC_THREADS",
    label: "Criar threads públicas",
    description: "Permite iniciar threads públicas.",
    scope: "text",
  },
  {
    key: "CREATE_PRIVATE_THREADS",
    label: "Criar threads privadas",
    description: "Permite iniciar threads privadas.",
    scope: "text",
  },
  {
    key: "SEND_MESSAGES_IN_THREADS",
    label: "Enviar mensagens em threads",
    description: "Permite conversar dentro de threads.",
    scope: "text",
  },
  {
    key: "SEND_VOICE_MESSAGES",
    label: "Enviar mensagens de voz",
    description: "Permite enviar mensagens de voz.",
    scope: "text",
  },
  {
    key: "SEND_POLLS",
    label: "Criar enquetes",
    description: "Permite enviar enquetes neste canal.",
    scope: "text",
  },
  {
    key: "PIN_MESSAGES",
    label: "Fixar mensagens",
    description: "Permite fixar e desafixar mensagens.",
    scope: "text",
  },
  {
    key: "BYPASS_SLOWMODE",
    label: "Ignorar modo lento",
    description: "Permite enviar mensagens sem aguardar o modo lento.",
    scope: "text",
  },
  {
    key: "CONNECT",
    label: "Conectar",
    description: "Permite entrar no canal de voz.",
    scope: "voice",
  },
  {
    key: "SPEAK",
    label: "Falar",
    description: "Permite transmitir áudio no canal.",
    scope: "voice",
  },
  {
    key: "STREAM",
    label: "Vídeo e transmissão",
    description: "Permite usar câmera e compartilhar a tela.",
    scope: "voice",
  },
  {
    key: "PRIORITY_SPEAKER",
    label: "Prioridade de fala",
    description: "Permite reduzir o volume dos outros participantes ao falar.",
    scope: "voice",
  },
  {
    key: "MUTE_MEMBERS",
    label: "Silenciar membros",
    description: "Permite silenciar outros participantes.",
    scope: "voice",
  },
  {
    key: "DEAFEN_MEMBERS",
    label: "Ensurdecer membros",
    description: "Permite ensurdecer outros participantes.",
    scope: "voice",
  },
  {
    key: "MOVE_MEMBERS",
    label: "Mover membros",
    description: "Permite mover participantes entre canais de voz.",
    scope: "voice",
  },
  {
    key: "USE_VAD",
    label: "Usar detecção de voz",
    description: "Permite falar sem usar aperte-para-falar.",
    scope: "voice",
  },
  {
    key: "USE_SOUNDBOARD",
    label: "Usar Soundboard",
    description: "Permite reproduzir sons no canal.",
    scope: "voice",
  },
  {
    key: "USE_EXTERNAL_SOUNDS",
    label: "Usar sons externos",
    description: "Permite reproduzir sons de outros servidores.",
    scope: "voice",
  },
  {
    key: "USE_EMBEDDED_ACTIVITIES",
    label: "Usar atividades",
    description: "Permite iniciar atividades compartilhadas.",
    scope: "voice",
  },
];

async function readResponse(response: Response) {
  const raw = response.status === 204 ? "" : await response.text();
  let data: any = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error || data?.message || raw || `Erro HTTP ${response.status}.`,
    );
  }

  return data;
}

function toBigInt(value: unknown) {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
}

function getPermissionState(
  draft: PermissionDraft,
  permission: bigint,
): PermissionState {
  if ((draft.allow & permission) === permission) return "allow";
  if ((draft.deny & permission) === permission) return "deny";
  return "inherit";
}

export default function ChannelSettingsModal({
  isOpen,
  onClose,
  channel,
  categories,
  onUpdated,
}: ChannelSettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [topic, setTopic] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [userLimit, setUserLimit] = useState(0);
  const [bitrate, setBitrate] = useState(64000);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [overwrites, setOverwrites] = useState<OverwriteSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PermissionDraft>>({});
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [canEditPermissions, setCanEditPermissions] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isVoice = channel?.type === "GUILD_VOICE";
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const selectedDraft = drafts[selectedRoleId] ?? { allow: 0n, deny: 0n };

  const visiblePermissions = useMemo(
    () =>
      PERMISSION_DEFINITIONS.filter(
        (permission) =>
          permission.scope === "all" ||
          (isVoice
            ? permission.scope === "voice"
            : permission.scope === "text"),
      ),
    [isVoice],
  );

  const filteredRoles = useMemo(() => {
    const query = roleSearch.trim().toLocaleLowerCase("pt-BR");
    if (!query) return roles;
    return roles.filter((role) =>
      (role.isDefault ? "@everyone" : role.name)
        .toLocaleLowerCase("pt-BR")
        .includes(query),
    );
  }, [roleSearch, roles]);

  useEffect(() => {
    if (!isOpen || !channel) return;
    setTab("general");
    setName(String(channel.name ?? ""));
    setCategoryId(String(channel.categoryId ?? ""));
    setTopic(String(channel.topic ?? ""));
    setNsfw(Boolean(channel.nsfw));
    setUserLimit(Number(channel.userLimit ?? 0));
    setBitrate(Number(channel.bitrate ?? 64000));
    setError(null);
    setSuccess(null);
  }, [channel, isOpen]);

  useEffect(() => {
    if (!isOpen || !channel?.id || tab !== "permissions") return;

    let cancelled = false;
    setIsLoadingPermissions(true);
    setError(null);

    fetch(
      `/api/channels/${encodeURIComponent(String(channel.id))}/permissions`,
      {
        cache: "no-store",
      },
    )
      .then(readResponse)
      .then((data) => {
        if (cancelled) return;
        const nextRoles = (data?.roles ?? []) as RoleSummary[];
        const nextOverwrites = (data?.overwrites ?? []) as OverwriteSummary[];
        const nextDrafts = Object.fromEntries(
          nextRoles.map((role) => {
            const overwrite = nextOverwrites.find(
              (entry) => entry.roleId === role.id,
            );
            return [
              role.id,
              {
                allow: toBigInt(overwrite?.allow),
                deny: toBigInt(overwrite?.deny),
              },
            ];
          }),
        );
        setRoles(nextRoles);
        setOverwrites(nextOverwrites);
        setDrafts(nextDrafts);
        setCanEditPermissions(Boolean(data?.canEditPermissions));
        setSelectedRoleId((current) =>
          nextRoles.some((role) => role.id === current)
            ? current
            : (nextRoles[0]?.id ?? ""),
        );
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as permissões.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPermissions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channel?.id, isOpen, tab]);

  const setPermissionState = (permission: bigint, state: PermissionState) => {
    if (!selectedRoleId || !canEditPermissions) return;

    setDrafts((current) => {
      const draft = current[selectedRoleId] ?? { allow: 0n, deny: 0n };
      let allow = draft.allow & ~permission;
      let deny = draft.deny & ~permission;

      if (state === "allow") allow |= permission;
      if (state === "deny") deny |= permission;

      return { ...current, [selectedRoleId]: { allow, deny } };
    });
    setSuccess(null);
  };

  const saveGeneralSettings = async () => {
    if (!channel?.id || !name.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await fetch(
        `/api/channels/${encodeURIComponent(String(channel.id))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            categoryId: categoryId || null,
            topic: isVoice ? undefined : topic || null,
            nsfw: isVoice ? undefined : nsfw,
            userLimit: isVoice ? userLimit : undefined,
            bitrate: isVoice ? bitrate : undefined,
          }),
        },
      ).then(readResponse);

      onUpdated(data.channel);
      setSuccess("Configurações do canal salvas.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o canal.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const saveRolePermissions = async () => {
    if (!channel?.id || !selectedRoleId || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await fetch(
        `/api/channels/${encodeURIComponent(String(channel.id))}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleId: selectedRoleId,
            allow: selectedDraft.allow.toString(),
            deny: selectedDraft.deny.toString(),
          }),
        },
      ).then(readResponse);

      setOverwrites((current) => {
        const remaining = current.filter(
          (overwrite) => overwrite.roleId !== selectedRoleId,
        );
        return data?.overwrite ? [...remaining, data.overwrite] : remaining;
      });
      setSuccess(
        `Permissões de ${selectedRole?.isDefault ? "@everyone" : selectedRole?.name} salvas.`,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar as permissões.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetRolePermissions = async () => {
    if (!channel?.id || !selectedRoleId || isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await fetch(
        `/api/channels/${encodeURIComponent(String(channel.id))}/permissions`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId: selectedRoleId }),
        },
      ).then(readResponse);
      setDrafts((current) => ({
        ...current,
        [selectedRoleId]: { allow: 0n, deny: 0n },
      }));
      setOverwrites((current) =>
        current.filter((overwrite) => overwrite.roleId !== selectedRoleId),
      );
      setSuccess("Permissões restauradas para o padrão herdado.");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Não foi possível restaurar as permissões.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSaving, onClose]);

  if (!isMounted || !isOpen || !channel) return null;

  const scrollbarClass =
    "[scrollbar-width:thin] [scrollbar-color:rgb(161_161_170)_transparent] dark:[scrollbar-color:rgb(82_82_91)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700";

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${channel.name}`}
        className="flex h-[min(780px,calc(100dvh-24px))] max-h-[calc(100dvh-24px)] w-[min(1120px,calc(100vw-24px))] min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111214]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-5 dark:border-white/[0.08]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
              Configurações do canal
            </p>
            <h2 className="mt-0.5 truncate text-base font-bold text-zinc-950 dark:text-white">
              {channel.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.06] dark:hover:text-white"
            aria-label="Fechar configurações"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-[190px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/70 p-3 dark:border-white/[0.08] dark:bg-black/20">
            <div className="space-y-1">
              {[
                {
                  id: "general" as const,
                  label: "Visão geral",
                  icon: isVoice ? Volume2 : Hash,
                },
                {
                  id: "permissions" as const,
                  label: "Permissões",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`flex h-10 w-full min-w-0 items-center gap-2.5 rounded-xl px-3 text-left text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                      tab === item.id
                        ? "bg-indigo-500 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {(error || success) && (
              <div className="shrink-0 px-4 pt-4">
                {error && (
                  <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold leading-5 text-red-600 dark:text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold leading-5 text-emerald-700 dark:text-emerald-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 break-words">{success}</span>
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-4">
              {tab === "general" ? (
                <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.08] dark:bg-white/[0.015]">
                  <div
                    className={`min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 ${scrollbarClass}`}
                  >
                    <label className="block min-w-0 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                        Nome do canal
                      </span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        maxLength={100}
                        className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-black/30 dark:text-white"
                      />
                    </label>

                    <label className="block min-w-0 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                        Categoria
                      </span>
                      <select
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214] dark:text-white"
                      >
                        <option value="">Sem categoria</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    {!isVoice && (
                      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_280px] gap-4">
                        <label className="block min-w-0 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                            Tópico
                          </span>
                          <textarea
                            value={topic}
                            onChange={(event) => setTopic(event.target.value)}
                            maxLength={1024}
                            rows={5}
                            placeholder="Sobre o que é este canal?"
                            className="h-[138px] w-full min-w-0 resize-none rounded-xl border border-zinc-300 bg-white p-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-black/30 dark:text-white"
                          />
                        </label>

                        <label className="flex h-[138px] min-w-0 items-center justify-between gap-4 self-end rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-white/[0.07] dark:bg-white/[0.02]">
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              Restrição de idade
                            </span>
                            <span className="mt-1 block text-[10px] leading-4 text-zinc-500">
                              Marca este canal como NSFW.
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={nsfw}
                            onChange={(event) => setNsfw(event.target.checked)}
                            className="h-4 w-4 shrink-0 accent-indigo-500"
                          />
                        </label>
                      </div>
                    )}

                    {isVoice && (
                      <div className="grid min-w-0 grid-cols-2 gap-4">
                        <label className="block min-w-0 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                            Limite de usuários
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={userLimit}
                            onChange={(event) =>
                              setUserLimit(Number(event.target.value))
                            }
                            className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-black/30 dark:text-white"
                          />
                        </label>

                        <label className="block min-w-0 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
                            Bitrate
                          </span>
                          <select
                            value={bitrate}
                            onChange={(event) =>
                              setBitrate(Number(event.target.value))
                            }
                            className="h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214] dark:text-white"
                          >
                            {[64000, 96000, 128000, 256000, 384000].map(
                              (value) => (
                                <option key={value} value={value}>
                                  {value / 1000} kbps
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                  <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-zinc-200 px-4 dark:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSaving}
                      className="h-10 rounded-xl px-4 text-xs font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => void saveGeneralSettings()}
                      disabled={isSaving || !name.trim()}
                      className="flex h-10 min-w-36 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                      Salvar alterações
                    </button>
                  </footer>
                </div>
              ) : (
                <div className="grid h-full min-h-0 min-w-0 grid-cols-[220px_minmax(0,1fr)] gap-3 overflow-hidden">
                  <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/70 dark:border-white/[0.07] dark:bg-black/20">
                    <div className="shrink-0 border-b border-zinc-200 p-2 dark:border-white/[0.07]">
                      <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-white/[0.07] dark:bg-white/[0.03]">
                        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        <input
                          value={roleSearch}
                          onChange={(event) => setRoleSearch(event.target.value)}
                          placeholder="Buscar cargo"
                          className="min-w-0 flex-1 bg-transparent text-xs text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
                        />
                      </label>
                    </div>

                    <div
                      className={`min-h-0 min-w-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 ${scrollbarClass}`}
                    >
                      {filteredRoles.length > 0 ? (
                        filteredRoles.map((role) => {
                          const overwrite = overwrites.find(
                            (entry) => entry.roleId === role.id,
                          );

                          return (
                            <button
                              key={role.id}
                              type="button"
                              onClick={() => {
                                setSelectedRoleId(role.id);
                                setError(null);
                                setSuccess(null);
                              }}
                              className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-xl px-2.5 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                                selectedRoleId === role.id
                                  ? "bg-indigo-500 text-white"
                                  : "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                              }`}
                            >
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                                style={{
                                  backgroundColor: role.color || "#99aab5",
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate">
                                {role.isDefault ? "@everyone" : role.name}
                              </span>
                              {overwrite && (
                                <span
                                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                    selectedRoleId === role.id
                                      ? "bg-white"
                                      : "bg-indigo-500"
                                  }`}
                                  title="Possui permissões personalizadas"
                                />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex h-24 items-center justify-center px-3 text-center text-[10px] font-medium text-zinc-500">
                          Nenhum cargo encontrado.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/[0.07] dark:bg-white/[0.015]">
                    {isLoadingPermissions ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      </div>
                    ) : selectedRole ? (
                      <>
                        <header className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 dark:border-white/[0.07]">
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    selectedRole.color || "#99aab5",
                                }}
                              />
                              <span className="min-w-0 truncate text-sm font-bold text-zinc-900 dark:text-white">
                                {selectedRole.isDefault
                                  ? "@everyone"
                                  : selectedRole.name}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-[10px] text-zinc-500">
                              Herdar usa o servidor; Permitir e Negar sobrescrevem neste canal.
                            </p>
                          </div>

                          {!canEditPermissions && (
                            <span className="shrink-0 rounded-lg border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                              Somente leitura
                            </span>
                          )}
                        </header>

                        <div
                          className={`min-h-0 min-w-0 flex-1 divide-y divide-zinc-200 overflow-y-auto overscroll-contain dark:divide-white/[0.06] ${scrollbarClass}`}
                        >
                          {visiblePermissions.map((permission) => {
                            const bit = Permissions[permission.key];
                            const state = getPermissionState(selectedDraft, bit);

                            return (
                              <div
                                key={permission.key}
                                className="grid min-w-0 grid-cols-[minmax(0,1fr)_270px] items-center gap-4 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-100">
                                    {permission.label}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-zinc-500">
                                    {permission.description}
                                  </p>
                                </div>

                                <div className="grid min-w-0 shrink-0 grid-cols-3 rounded-xl bg-zinc-100 p-1 dark:bg-white/[0.05]">
                                  {[
                                    {
                                      value: "inherit" as const,
                                      label: "Herdar",
                                      icon: CircleSlash2,
                                    },
                                    {
                                      value: "allow" as const,
                                      label: "Permitir",
                                      icon: Check,
                                    },
                                    {
                                      value: "deny" as const,
                                      label: "Negar",
                                      icon: X,
                                    },
                                  ].map((option) => {
                                    const Icon = option.icon;
                                    const active = state === option.value;

                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                          setPermissionState(bit, option.value)
                                        }
                                        disabled={
                                          !canEditPermissions || isSaving
                                        }
                                        title={option.label}
                                        aria-pressed={active}
                                        className={`flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${
                                          active && option.value === "allow"
                                            ? "bg-emerald-500 text-white"
                                            : active && option.value === "deny"
                                              ? "bg-red-500 text-white"
                                              : active
                                                ? "bg-white text-zinc-700 shadow-sm dark:bg-white/[0.09] dark:text-white"
                                                : "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                                        }`}
                                      >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">
                                          {option.label}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <footer className="flex h-16 shrink-0 items-center justify-between gap-3 border-t border-zinc-200 px-3 dark:border-white/[0.07]">
                          <button
                            type="button"
                            onClick={() => void resetRolePermissions()}
                            disabled={!canEditPermissions || isSaving}
                            className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/[0.06] dark:hover:text-white"
                          >
                            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Restaurar herança</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void saveRolePermissions()}
                            disabled={!canEditPermissions || isSaving}
                            className="flex h-10 min-w-36 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-[10px] font-bold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving && (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            )}
                            Salvar permissões
                          </button>
                        </footer>
                      </>
                    ) : (
                      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-xs text-zinc-500">
                        Selecione um cargo.
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>,
    document.body,
  );
}
