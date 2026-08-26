

import {
  Check,
  CircleUserRound,
  Copy,
  MessageCircle,
  MoreHorizontal,
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
import { onGatewayEvent } from "@/lib/realtime/gateway-client";
import Banner from "../Image/Banner";

interface PopupPosition {
  top: number;
  left: number;
}

const POPUP_WIDTH = 340;
const POPUP_GAP = 12;
const VIEWPORT_GAP = 8;

export default function MembersSidebar({
  members,
  guildId,
}: {
  members: any[];
  guildId?: string;
}) {
  const [liveMembers, setLiveMembers] = useState<any[]>(members ?? []);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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

          const {
            id: _id,
            userId: _userId,
            ...patch
          } = data ?? {};

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
      return Object.values(
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
      ).sort(
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

  const getBannerUrl = (
    user: any,
  ): string | null => {
    if (!user) {
      return null;
    }

    if (
      typeof user.bannerUrl ===
        "string" &&
      user.bannerUrl
    ) {
      return user.bannerUrl;
    }

    if (
      typeof user.bannerURL ===
        "string" &&
      user.bannerURL
    ) {
      return user.bannerURL;
    }

    if (
      typeof user.banner ===
        "string" &&
      user.banner
    ) {
      return user.banner;
    }

    if (
      typeof user.banner?.url ===
        "string" &&
      user.banner.url
    ) {
      return user.banner.url;
    }

    if (
      typeof user.profile
        ?.bannerUrl ===
        "string" &&
      user.profile.bannerUrl
    ) {
      return user.profile
        .bannerUrl;
    }

    return null;
  };

  const getBannerColor = (
    user: any,
  ): string | undefined => {
    return (
      user?.bannerColor ??
      user?.accentColor ??
      undefined
    );
  };

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
      <aside className="relative hidden min-h-0 w-60 shrink-0 flex-col border-l border-stone-300 bg-white dark:border-zinc-800/50 dark:bg-[#111214] lg:flex">
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
                          className="group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:bg-stone-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
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
                        className="group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-stone-200 focus:outline-none focus-visible:bg-stone-200 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
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

          const bannerUrl =
            getBannerUrl(user);

          const bannerColor =
            getBannerColor(
              user,
            );

          return (
            <div
              ref={popupRef}
              className="fixed z-[9999] max-h-[calc(100dvh-16px)] w-[340px] max-w-[calc(100vw-16px)] overflow-x-hidden overflow-y-auto rounded-xl border border-stone-300 bg-white text-stone-900 shadow-[0_20px_70px_rgba(0,0,0,0.22)] dark:border-zinc-700/70 dark:bg-[#111214] dark:text-white dark:shadow-[0_20px_70px_rgba(0,0,0,0.65)]"
              style={{
                top:
                  popupPosition.top,
                left:
                  popupPosition.left,
              }}
            >
              <div
                className={`relative h-28 shrink-0 overflow-hidden ${
                  !bannerUrl
                    ? "bg-gradient-to-br from-indigo-400 via-purple-400 to-fuchsia-400 dark:from-indigo-600 dark:via-purple-600 dark:to-fuchsia-600"
                    : ""
                }`}
                style={{
                  backgroundColor:
                    !bannerUrl
                      ? bannerColor
                      : undefined,
                }}
              >
                {bannerUrl && (
                  <Banner
                    bannerUrl={
                      bannerUrl
                    }
                    
                  />
                )}

                {!bannerUrl && (
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                )}

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

              <div className="relative px-4">
                <div className="absolute -top-12 left-4">
                  <div className="relative">
                    <div className="overflow-hidden rounded-full border-[6px] border-white dark:border-[#111214]">
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
                        className="h-20 w-20"
                      />
                    </div>

                    <span
                      className={`absolute bottom-1 right-1 h-5 w-5 rounded-full border-[4px] border-white dark:border-[#111214] ${getStatusColor(
                        user.status,
                      )}`}
                    />
                  </div>
                </div>

                <div className="pt-12">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-stone-900 dark:text-white">
                      {user?.globalName ||
                        user?.username}
                    </h2>

                    <button
                      type="button"
                      title="Mais opções"
                      className="shrink-0 text-stone-400 transition-colors hover:text-stone-700 dark:text-zinc-500 dark:hover:text-white"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="truncate text-sm text-stone-500 dark:text-zinc-400">
                    @
                    {
                      user.username
                    }
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase text-stone-500 dark:text-zinc-400">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(
                        user.status,
                      )}`}
                    />

                    {getStatusLabel(
                      user.status,
                    )}
                  </div>
                </div>

                {selectedMember.roles &&
                  selectedMember
                    .roles.length >
                    0 && (
                    <>
                      <div className="my-4 h-px bg-stone-200 dark:bg-zinc-800" />

                      <div>
                        <div className="mb-2 text-xs font-bold uppercase text-stone-500 dark:text-zinc-400">
                          Roles
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {[
                            ...selectedMember.roles,
                          ]
                            .sort(
                              (
                                a: any,
                                b: any,
                              ) =>
                                b.position -
                                a.position,
                            )
                            .map(
                              (
                                role: any,
                              ) => (
                                <div
                                  key={
                                    role.id
                                  }
                                  className="flex min-w-0 max-w-full items-center gap-1.5 rounded-md border border-stone-300 bg-stone-100 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800/70"
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor:
                                        role.color ||
                                        "#71717a",
                                    }}
                                  />

                                  <span className="truncate text-stone-700 dark:text-zinc-300">
                                    {
                                      role.name
                                    }
                                  </span>
                                </div>
                              ),
                            )}
                        </div>
                      </div>
                    </>
                  )}

                <div className="my-4 h-px bg-stone-200 dark:bg-zinc-800" />

                <div className="flex items-center gap-2 pb-4">
                  <button
                    type="button"
                    className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />

                    <span className="truncate">
                      Mensagem
                    </span>
                  </button>

                  <button
                    type="button"
                    title="Copiar ID"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          String(
                            user.id,
                          ),
                        );
                      } catch (
                        error
                      ) {
                        console.error(
                          "[COPY_USER_ID_ERROR]",
                          error,
                        );
                      }
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-200 text-stone-600 transition-colors hover:bg-stone-300 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Ver perfil"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stone-200 text-stone-600 transition-colors hover:bg-stone-300 hover:text-stone-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                  >
                    <CircleUserRound className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}