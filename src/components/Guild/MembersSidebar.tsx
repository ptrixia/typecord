

import {
  Check,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Avatar from "../Image/Avatar";
import { resolveFileUrl } from "../Image/Avatar";
import { onGatewayEvent } from "@/lib/realtime/gateway-client";
import { toggleMemberRole } from "@/actions/members";
import { useToast } from "@/components/app/ToastProvider";
import {
  Permissions,
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";
import RichPresenceBadge from "../Profile/RichPresenceBadge";

interface PopupPosition {
  top: number;
  left: number;
}

const POPUP_WIDTH = 380;
const POPUP_GAP = 12;
const VIEWPORT_GAP = 8;

export default function MembersSidebar({
  members,
  guildId,
  roles = [],
  currentMember,
}: {
  members: any[];
  guildId?: string;
  roles?: any[];
  currentMember?: any;
}) {
  const [liveMembers, setLiveMembers] = useState<any[]>(members ?? []);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [roleActionId, setRoleActionId] = useState<string | null>(null);
  const { pushToast } = useToast();

  const [popupPosition, setPopupPosition] =
    useState<PopupPosition>({
      top: 100,
      left: 100,
    });

  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const getUser = useCallback((member: any) => {
    return member?.user ?? member;
  }, []);

  const getUserId = useCallback(
    (member: any) => {
      const user = getUser(member);

      return String(
        user?.id ??
          member?.userId ??
          "",
      );
    },
    [getUser],
  );

  const getMemberId = useCallback(
    (member: any) => {
      return String(
        member?.id ??
          member?.userId ??
          getUser(member)?.id ??
          "",
      );
    },
    [getUser],
  );

  useEffect(() => {
    setLiveMembers(members ?? []);
  }, [members]);

  useEffect(() => {
    const patchUser = (
      userId: string,
      patch: Record<string, unknown>,
    ) => {
      setLiveMembers((current) =>
        current.map((member) => {
          const user = member?.user ?? member;

          const id = String(
            user?.id ??
              member?.userId ??
              "",
          );

          if (id !== String(userId)) {
            return member;
          }

          if (member?.user) {
            return {
              ...member,
              user: {
                ...member.user,
                ...patch,
              },
            };
          }

          return {
            ...member,
            ...patch,
          };
        }),
      );
    };

    const removePresence =
      onGatewayEvent<any>(
        "PRESENCE_UPDATE",
        ({ data }) => {
          const userId = String(
            data?.userId ??
              data?.user?.id ??
              "",
          );

          if (!userId) return;

          patchUser(userId, {
            status:
              data?.online === false
                ? "OFFLINE"
                : data?.status ?? "ONLINE",
            richPresence: data?.richPresence ?? null,
          });
        },
      );

    const removeUserUpdate =
      onGatewayEvent<any>(
        "USER_UPDATE",
        ({ data }) => {
          const userId = String(
            data?.id ??
              data?.userId ??
              "",
          );

          if (!userId) return;

          const patch = { ...(data ?? {}) };
          delete patch.id;
          delete patch.userId;

          patchUser(userId, patch);
        },
      );

    const removeMemberUpdate =
      onGatewayEvent<any>(
        "GUILD_MEMBER_UPDATE",
        ({ data }) => {
          if (
            data?.guildId &&
            guildId &&
            String(data.guildId) !== String(guildId)
          ) {
            return;
          }

          const incoming =
            data?.member ?? data;

          const incomingUserId =
            String(
              incoming?.user?.id ??
                incoming?.userId ??
                "",
            );

          if (!incomingUserId) {
            return;
          }

          setLiveMembers((current) =>
            current.map((member) => {
              const currentUserId =
                String(
                  member?.user?.id ??
                    member?.userId ??
                    "",
                );

              if (
                currentUserId !==
                incomingUserId
              ) {
                return member;
              }

              return {
                ...member,
                ...incoming,

                user: {
                  ...(member?.user ?? {}),
                  ...(incoming?.user ?? {}),
                },
              };
            }),
          );
        },
      );

    const removeMemberAdd =
      onGatewayEvent<any>(
        "GUILD_MEMBER_ADD",
        ({ data }) => {
          if (
            data?.guildId &&
            guildId &&
            String(data.guildId) !== String(guildId)
          ) {
            return;
          }

          const incoming =
            data?.member ?? data;

          if (!incoming) return;

          const incomingUserId =
            String(
              incoming?.user?.id ??
                incoming?.userId ??
                incoming?.id ??
                "",
            );

          if (!incomingUserId) {
            return;
          }

          setLiveMembers((current) => {
            const exists =
              current.some((member) => {
                const currentUserId =
                  String(
                    member?.user?.id ??
                      member?.userId ??
                      member?.id ??
                      "",
                  );

                return (
                  currentUserId ===
                  incomingUserId
                );
              });

            if (exists) {
              return current;
            }

            return [
              ...current,
              incoming,
            ];
          });
        },
      );

    const removeMemberRemove =
      onGatewayEvent<any>(
        "GUILD_MEMBER_REMOVE",
        ({ data }) => {
          if (
            data?.guildId &&
            guildId &&
            String(data.guildId) !== String(guildId)
          ) {
            return;
          }

          const memberId =
            String(
              data?.memberId ??
                data?.id ??
                "",
            );

          const userId =
            String(
              data?.userId ??
                data?.user?.id ??
                "",
            );

          if (
            !memberId &&
            !userId
          ) {
            return;
          }

          setLiveMembers((current) =>
            current.filter((member) => {
              const currentMemberId =
                String(
                  member?.id ?? "",
                );

              const currentUserId =
                String(
                  member?.user?.id ??
                    member?.userId ??
                    "",
                );

              return !(
                (memberId &&
                  currentMemberId ===
                    memberId) ||
                (userId &&
                  currentUserId ===
                    userId)
              );
            }),
          );

          if (
            userId &&
            selectedMemberId ===
              userId
          ) {
            setSelectedMemberId(
              null,
            );
          }
        },
      );

    return () => {
      removePresence();
      removeUserUpdate();
      removeMemberUpdate();
      removeMemberAdd();
      removeMemberRemove();
    };
  }, [
    guildId,
    selectedMemberId,
  ]);

  const selectedMember =
    useMemo(() => {
      if (!selectedMemberId) {
        return null;
      }

      return (
        liveMembers.find(
          (member) =>
            getUserId(member) ===
            selectedMemberId,
        ) ?? null
      );
    }, [
      liveMembers,
      selectedMemberId,
      getUserId,
    ]);

  const getHighestRole = (
    member: any,
  ) => {
    if (
      !member.roles ||
      member.roles.length === 0
    ) {
      return null;
    }

    return [
      ...member.roles,
    ].sort(
      (a, b) =>
        b.position -
        a.position,
    )[0];
  };

  const isOffline = useCallback(
    (member: any) => {
      const user = getUser(member);
      const status = String(user?.status ?? "OFFLINE").toUpperCase();

      return status === "OFFLINE";
    },
    [getUser],
  );

  const groupedMembers =
    useMemo(() => {
      return (Object.values(
        (
          liveMembers || []
        ).reduce<
          Record<
            string,
            {
              role: any;
              members: any[];
            }
          >
        >(
          (
            groups,
            member,
          ) => {
            if (isOffline(member)) {
              return groups;
            }

            const defaultRole = {
              id: "0",
              name: "Membro",
              position: 0,
              color: "#a1a1aa",
            };

            const highestRole =
              getHighestRole(
                member,
              ) || defaultRole;

            const key =
              String(
                highestRole.id,
              );

            if (!groups[key]) {
              groups[key] = {
                role:
                  highestRole,
                members: [],
              };
            }

            groups[
              key
            ].members.push(
              member,
            );

            return groups;
          },
          {},
        ),
      ) as Array<{ role: any; members: any[] }>).sort(
        (a, b) =>
          b.role.position -
          a.role.position,
      );
    }, [liveMembers, isOffline]);

  const offlineMembers =
    useMemo(() => {
      return (liveMembers || []).filter(
        (member) => isOffline(member),
      );
    }, [liveMembers, isOffline]);

  const sortedRoles = useMemo(
    () =>
      [...(roles ?? [])].sort(
        (a: any, b: any) => Number(b.position ?? 0) - Number(a.position ?? 0),
      ),
    [roles],
  );

  const actorPermissions = useMemo(() => {
    return (currentMember?.roles ?? []).reduce(
      (bits: bigint, role: any) => bits | normalizePermissions(role?.permissions),
      0n,
    );
  }, [currentMember?.roles]);

  const canManageRoles = hasPermission(actorPermissions, Permissions.MANAGE_ROLES);

  const selectedMemberRoles = useMemo(
    () =>
      [...(selectedMember?.roles ?? [])].sort(
        (a: any, b: any) => Number(b.position ?? 0) - Number(a.position ?? 0),
      ),
    [selectedMember?.roles],
  );

  const assignableRoles = useMemo(() => {
    const assigned = new Set(
      selectedMemberRoles.map((role: any) => String(role.id)),
    );

    return sortedRoles.filter(
      (role: any) =>
        !assigned.has(String(role.id)) &&
        !role?.isDefault &&
        !role?.managed,
    );
  }, [selectedMemberRoles, sortedRoles]);

  const getStatusColor = (
    status?: string,
  ) => {
    switch (status) {
      case "ONLINE":
        return "bg-emerald-500";

      case "IDLE":
        return "bg-yellow-400";

      case "DND":
        return "bg-red-500";

      default:
        return "bg-zinc-500";
    }
  };

  const getStatusLabel = (
    status?: string,
  ) => {
    switch (status) {
      case "ONLINE":
        return "Online";
      case "IDLE":
        return "Ausente";
      case "DND":
        return "Não perturbe";
      default:
        return "Offline";
    }
  };

  const toggleRole = useCallback(
    async (role: any) => {
      const memberId = String(selectedMember?.id ?? "");
      const roleId = String(role?.id ?? "");

      if (!memberId || !roleId || roleActionId) {
        return;
      }

      try {
        setRoleActionId(roleId);
        const added = await toggleMemberRole(memberId, roleId);

        const nextRole = sortedRoles.find(
          (item: any) => String(item.id) === roleId,
        ) ?? role;

        setLiveMembers((current) =>
          current.map((member) => {
            if (String(member?.id ?? "") !== memberId) {
              return member;
            }

            const currentRoles = Array.isArray(member.roles)
              ? member.roles
              : [];

            return {
              ...member,
              roles: added
                ? [...currentRoles, nextRole]
                : currentRoles.filter(
                    (item: any) => String(item.id) !== roleId,
                  ),
            };
          }),
        );

        setRoleMenuOpen(false);
        pushToast({
          type: "success",
          title: added ? "Cargo adicionado" : "Cargo removido",
          description: role?.name,
        });
      } catch (error) {
        pushToast({
          type: "error",
          title: "Cargo não atualizado",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível alterar o cargo.",
        });
      } finally {
        setRoleActionId(null);
      }
    },
    [pushToast, roleActionId, selectedMember?.id, sortedRoles],
  );

  const updatePopupPosition =
    useCallback(() => {
      const popup =
        popupRef.current;

      const trigger =
        triggerRef.current;

      if (
        !popup ||
        !trigger
      ) {
        return;
      }

      const triggerRect =
        trigger.getBoundingClientRect();

      const popupRect =
        popup.getBoundingClientRect();

      const viewportWidth =
        window.innerWidth;

      const viewportHeight =
        window.innerHeight;

      const actualPopupWidth =
        popupRect.width;

      const actualPopupHeight =
        Math.min(
          popupRect.height,
          viewportHeight -
            VIEWPORT_GAP * 2,
        );

      let left =
        triggerRect.left -
        actualPopupWidth -
        POPUP_GAP;

      if (
        left <
        VIEWPORT_GAP
      ) {
        left =
          triggerRect.right +
          POPUP_GAP;
      }

      if (
        left +
          actualPopupWidth >
        viewportWidth -
          VIEWPORT_GAP
      ) {
        left =
          viewportWidth -
          actualPopupWidth -
          VIEWPORT_GAP;
      }

      if (
        left <
        VIEWPORT_GAP
      ) {
        left =
          VIEWPORT_GAP;
      }

      let top =
        triggerRect.top;

      if (
        top +
          actualPopupHeight >
        viewportHeight -
          VIEWPORT_GAP
      ) {
        top =
          viewportHeight -
          actualPopupHeight -
          VIEWPORT_GAP;
      }

      if (
        top <
        VIEWPORT_GAP
      ) {
        top =
          VIEWPORT_GAP;
      }

      setPopupPosition({
        top,
        left,
      });
    }, []);

  const openMemberProfile =
    useCallback(
      (
        member: any,
        event: React.MouseEvent<HTMLDivElement>,
      ) => {
        const userId =
          getUserId(member);

        if (!userId) {
          return;
        }

        triggerRef.current =
          event.currentTarget;

        const rect =
          event.currentTarget.getBoundingClientRect();

        const estimatedWidth =
          Math.min(
            POPUP_WIDTH,
            window.innerWidth -
              VIEWPORT_GAP * 2,
          );

        let left =
          rect.left -
          estimatedWidth -
          POPUP_GAP;

        if (
          left <
          VIEWPORT_GAP
        ) {
          left =
            rect.right +
            POPUP_GAP;
        }

        if (
          left +
            estimatedWidth >
          window.innerWidth -
            VIEWPORT_GAP
        ) {
          left =
            window.innerWidth -
            estimatedWidth -
            VIEWPORT_GAP;
        }

        setPopupPosition({
          top: Math.max(
            VIEWPORT_GAP,
            rect.top,
          ),
          left: Math.max(
            VIEWPORT_GAP,
            left,
          ),
        });

        setSelectedMemberId(
          userId,
        );
      },
      [getUserId],
    );

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    setRoleMenuOpen(false);

    const animationFrame =
      requestAnimationFrame(
        updatePopupPosition,
      );

    const handleResize = () => {
      updatePopupPosition();
    };

    const handleScroll = () => {
      updatePopupPosition();
    };

    window.addEventListener(
      "resize",
      handleResize,
    );

    window.addEventListener(
      "scroll",
      handleScroll,
      true,
    );

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "resize",
        handleResize,
      );

      window.removeEventListener(
        "scroll",
        handleScroll,
        true,
      );
    };
  }, [
    selectedMember,
    updatePopupPosition,
  ]);

  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      const clickedPopup =
        popupRef.current?.contains(
          target,
        );

      const clickedTrigger =
        triggerRef.current?.contains(
          target,
        );

      if (
        !clickedPopup &&
        !clickedTrigger
      ) {
        setSelectedMemberId(
          null,
        );
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === "Escape"
      ) {
        setSelectedMemberId(
          null,
        );
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [selectedMember]);

  return (
    <>
      <aside data-focus-secondary className="typecord-members-sidebar relative hidden min-h-0 w-60 shrink-0 flex-col border-l border-stone-300 bg-white dark:border-zinc-800/50 dark:bg-[#111214] lg:flex">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
          {groupedMembers.map(
            ({
              role,
              members:
                roleMembers,
            }) => (
              <section
                key={role.id}
                className="mb-5 last:mb-0"
              >
                <div className="mb-1.5 px-1">
                  <h3 className="truncate text-[11px] font-bold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    {role.name} —{" "}
                    {
                      roleMembers.length
                    }
                  </h3>
                </div>

                <div className="space-y-0.5">
                  {roleMembers.map(
                    (member) => {
                      const user =
                        getUser(
                          member,
                        );

                      if (!user) {
                        return null;
                      }

                      return (
                        <div
                          key={
                            getMemberId(
                              member,
                            ) ||
                            getUserId(
                              member,
                            )
                          }
                          onClick={(
                            event,
                          ) =>
                            openMemberProfile(
                              member,
                              event,
                            )
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(
                            event,
                          ) => {
                            if (
                              event.key ===
                                "Enter" ||
                              event.key ===
                                " "
                            ) {
                              event.preventDefault();

                              openMemberProfile(
                                member,
                                event as unknown as React.MouseEvent<HTMLDivElement>,
                              );
                            }
                          }}
                          className="typecord-member-row group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:bg-stone-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                        >
                          <div className="relative shrink-0">
                            <Avatar
                              avatarUrl={
                                user.avatarUrl
                              }
                              username={
                                user.username
                              }
                              globalName={
                                user.globalName
                              }
                              className="h-8 w-8"
                            />

                            <span
                              className={`absolute bottom-[-1px] right-[-1px] h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#111214] ${getStatusColor(
                                user?.status,
                              )}`}
                            />
                          </div>

                          <span
                            className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700 dark:text-zinc-300"
                            style={{
                              color:
                                role.color ||
                                undefined,
                            }}
                          >
                            {user?.globalName ||
                              user?.username}
                          </span>

                          {user?.bot && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
                              BOT

                              {user.bot
                                .verified && (
                                <Check
                                  strokeWidth={
                                    3
                                  }
                                  className="h-3 w-3 shrink-0 text-white"
                                />
                              )}
                            </span>
                          )}
                          <RichPresenceBadge presence={user?.richPresence} compact />
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            ),
          )}

          {offlineMembers.length > 0 && (
            <section className="mb-5 last:mb-0">
              <div className="mb-1.5 px-1">
                <h3 className="truncate text-[11px] font-bold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                  Offline —{" "}
                  {
                    offlineMembers.length
                  }
                </h3>
              </div>

              <div className="space-y-0.5">
                {offlineMembers.map(
                  (member) => {
                    const user =
                      getUser(
                        member,
                      );

                    if (!user) {
                      return null;
                    }

                    const highestRole =
                      getHighestRole(
                        member,
                      );

                    return (
                      <div
                        key={
                          getMemberId(
                            member,
                          ) ||
                          getUserId(
                            member,
                          )
                        }
                        onClick={(
                          event,
                        ) =>
                          openMemberProfile(
                            member,
                            event,
                          )
                        }
                        role="button"
                        tabIndex={0}
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            event.preventDefault();

                            openMemberProfile(
                              member,
                              event as unknown as React.MouseEvent<HTMLDivElement>,
                            );
                          }
                        }}
                        className="typecord-member-row group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:bg-stone-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
                      >
                        <div className="relative shrink-0">
                          <Avatar
                            avatarUrl={
                              user.avatarUrl
                            }
                            username={
                              user.username
                            }
                            globalName={
                              user.globalName
                            }
                            className="h-8 w-8"
                          />

                          <span
                            className={`absolute bottom-[-1px] right-[-1px] h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#111214] ${getStatusColor(
                              user?.status,
                            )}`}
                          />
                        </div>

                        <span
                          className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700 dark:text-zinc-300"
                          style={{
                            color:
                              highestRole?.color ||
                              undefined,
                          }}
                        >
                          {user?.globalName ||
                            user?.username}
                        </span>

                        {user?.bot && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-[3px] bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
                            BOT

                            {user.bot
                              .verified && (
                              <Check
                                strokeWidth={
                                  3
                                }
                                className="h-3 w-3 shrink-0 text-white"
                              />
                            )}
                          </span>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          )}
        </div>
      </aside>

      {selectedMember &&
        (() => {
          const user =
            getUser(
              selectedMember,
            );

          if (!user) {
            return null;
          }

          const displayName =
            user?.globalName ||
            user?.displayName ||
            user?.username ||
            "Usuário";

          const bannerUrl =
            resolveFileUrl(user?.bannerUrl ?? user?.banner ?? null);

          const bio =
            user?.bio ||
            user?.customStatus ||
            "Nenhuma descrição adicionada.";

          return (
            <div
              ref={popupRef}
              className="fixed z-[9999] max-h-[calc(100dvh-16px)] w-[380px] max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-2xl border border-stone-300 bg-white text-stone-900 shadow-[0_22px_80px_rgba(0,0,0,0.24)] dark:border-white/10 dark:bg-[#111214] dark:text-white dark:shadow-[0_22px_80px_rgba(0,0,0,0.7)]"
              style={{
                top:
                  popupPosition.top,
                left:
                  popupPosition.left,
              }}
            >
              <div className="relative h-32 overflow-hidden bg-indigo-600">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt={`Banner de ${displayName}`}
                    draggable={false}
                    className="h-full w-full select-none object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                <button
                  type="button"
                  aria-label="Fechar"
                  onClick={() =>
                    setSelectedMemberId(
                      null,
                    )
                  }
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/40 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 pb-5">
                <div className="-mt-10 flex items-end gap-3">
                  <div className="relative rounded-full border-4 border-white dark:border-[#111214]">
                    <Avatar
                      avatarUrl={user.avatarUrl}
                      username={user.username}
                      globalName={user.globalName}
                      className="h-20 w-20"
                    />
                    <span
                      className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-[4px] border-white dark:border-[#111214] ${getStatusColor(
                        user.status,
                      )}`}
                    />
                  </div>

                  <div className="min-w-0 pb-2">
                    <h2 className="truncate text-xl font-black text-stone-950 dark:text-white">
                      {displayName}
                    </h2>
                    <p className="truncate text-sm text-stone-500 dark:text-zinc-400">
                      @{user.username}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 font-bold text-stone-600 dark:bg-white/[0.06] dark:text-zinc-300">
                    <span
                      className={`h-2 w-2 rounded-full ${getStatusColor(user.status)}`}
                    />
                    {getStatusLabel(user.status)}
                  </span>
                  {user?.bot && (
                    <span className="rounded-full bg-indigo-500 px-2.5 py-1 font-black uppercase text-white">
                      BOT
                    </span>
                  )}
                </div>

                <div className="mt-3"><RichPresenceBadge presence={user?.richPresence} /></div>

                <div className="mt-5 rounded-xl bg-stone-100 px-3 py-3 dark:bg-white/[0.06]">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-400">
                    Sobre
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700 dark:text-zinc-300">
                    {bio}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-stone-500 dark:text-zinc-400">
                      Cargos
                    </h3>

                    {canManageRoles && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setRoleMenuOpen((current) => !current)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
                          title="Adicionar cargo"
                          aria-label="Adicionar cargo"
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        {roleMenuOpen && (
                          <div className="absolute right-0 top-8 z-20 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white p-1 shadow-2xl dark:border-white/10 dark:bg-[#18191c]">
                            {assignableRoles.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-stone-500 dark:text-zinc-400">
                                Nenhum cargo disponível.
                              </div>
                            ) : (
                              assignableRoles.map((role: any) => (
                                <button
                                  key={role.id}
                                  type="button"
                                  disabled={Boolean(roleActionId)}
                                  onClick={() => void toggleRole(role)}
                                  className="flex w-full min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-stone-700 transition hover:bg-stone-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                                >
                                  <span
                                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: role.color || "#71717a",
                                    }}
                                  />
                                  <span className="truncate">{role.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedMemberRoles.length === 0 ? (
                      <span className="text-xs text-stone-500 dark:text-zinc-500">
                        Sem cargos atribuídos.
                      </span>
                    ) : (
                      selectedMemberRoles.map((role: any) => (
                        <span
                          key={role.id}
                          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-100 px-2 py-1 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800/70"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: role.color || "#71717a",
                            }}
                          />
                          <span className="truncate text-stone-700 dark:text-zinc-300">
                            {role.name}
                          </span>
                          {canManageRoles && !role.isDefault && !role.managed && (
                            <button
                              type="button"
                              disabled={roleActionId === String(role.id)}
                              onClick={() => void toggleRole(role)}
                              className="ml-0.5 rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-zinc-700"
                              title={`Remover ${role.name}`}
                              aria-label={`Remover ${role.name}`}
                            >
                              {roleActionId === String(role.id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-stone-200 pt-4 text-xs dark:border-zinc-800">
                  <div className="min-w-0">
                    <div className="font-black uppercase tracking-[0.12em] text-stone-400">
                      Membro
                    </div>
                    <div className="mt-1 truncate font-mono text-stone-600 dark:text-zinc-300">
                      {String(selectedMember.id ?? "-")}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="font-black uppercase tracking-[0.12em] text-stone-400">
                      Usuário
                    </div>
                    <div className="mt-1 truncate font-mono text-stone-600 dark:text-zinc-300">
                      {String(user.id ?? "-")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
