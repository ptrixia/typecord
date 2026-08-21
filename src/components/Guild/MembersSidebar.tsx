"use client";

import {
  CircleUserRound,
  Copy,
  MessageCircle,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Role {
  id: number;
  name: string;
  permissions: string[];
  position: number;
  color?: string;
}

interface Member {
  id: number;
  name: string;
  username: string;
  avatarUrl: string;
  status?: "online" | "idle" | "dnd" | "offline";
  customStatus?: string;
  createdAt?: string;
  roles: Role[];
}

interface PopupPosition {
  top: number;
  left: number;
}

export default function MembersSidebar() {
  const members: Member[] = [
    {
      id: 1,
      name: "Member 1",
      username: "member1",
      avatarUrl: "https://placehold.co/256",
      status: "online",
      customStatus: "Jogando Fortnite 🎮",
      createdAt: "21 de agosto de 2026",
      roles: [
        {
          id: 1,
          name: "Admin",
          permissions: ["manage_server"],
          position: 100,
          color: "#ef4444",
        },
        {
          id: 2,
          name: "Moderator",
          permissions: ["manage_messages"],
          position: 50,
          color: "#8b5cf6",
        },
      ],
    },

    {
      id: 2,
      name: "Member 2",
      username: "member2",
      avatarUrl: "https://placehold.co/256",
      status: "idle",
      customStatus: "Assistindo alguma coisa 👀",
      createdAt: "18 de agosto de 2026",
      roles: [
        {
          id: 2,
          name: "Moderator",
          permissions: ["manage_messages"],
          position: 50,
          color: "#8b5cf6",
        },
      ],
    },

    {
      id: 3,
      name: "Member 3",
      username: "member3",
      avatarUrl: "https://placehold.co/256",
      status: "dnd",
      customStatus: "Não perturbe 🔴",
      createdAt: "10 de agosto de 2026",
      roles: [
        {
          id: 3,
          name: "Member",
          permissions: [],
          position: 1,
          color: "#a1a1aa",
        },
      ],
    },
  ];

  const [selectedMember, setSelectedMember] =
    useState<Member | null>(null);

  const [popupPosition, setPopupPosition] =
    useState<PopupPosition>({
      top: 100,
      left: 100,
    });

  const popupRef = useRef<HTMLDivElement>(null);

  
  const getHighestRole = (
    member: Member,
  ): Role | null => {
    if (member.roles.length === 0) {
      return null;
    }

    return [...member.roles].sort(
      (a, b) => b.position - a.position,
    )[0];
  };

  
  const groupedMembers = Object.values(
    members.reduce<
      Record<
        string,
        {
          role: Role;
          members: Member[];
        }
      >
    >((groups, member) => {
      const highestRole = getHighestRole(member);

      if (!highestRole) {
        return groups;
      }

      const key = String(highestRole.id);

      if (!groups[key]) {
        groups[key] = {
          role: highestRole,
          members: [],
        };
      }

      groups[key].members.push(member);

      return groups;
    }, {}),
  ).sort(
    (a, b) => b.role.position - a.role.position,
  );

  
  const openMemberProfile = (
    member: Member,
    event: React.MouseEvent<HTMLDivElement>,
  ) => {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const popupWidth = 340;
    const popupHeight = 560;
    const gap = 12;

    let left =
      rect.left - popupWidth - gap;

    let top = rect.top;

    
    if (left < 8) {
      left = rect.right + gap;
    }

    
    if (
      left + popupWidth >
      window.innerWidth - 8
    ) {
      left =
        window.innerWidth -
        popupWidth -
        8;
    }

    
    if (
      top + popupHeight >
      window.innerHeight - 8
    ) {
      top =
        window.innerHeight -
        popupHeight -
        8;
    }

    
    if (top < 8) {
      top = 8;
    }

    setPopupPosition({
      top,
      left,
    });

    setSelectedMember(member);
  };


  useEffect(() => {
    if (!selectedMember) {
      return;
    }

    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target =
        event.target as Node;

      if (
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setSelectedMember(null);
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );
    };
  }, [selectedMember]);

  
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setSelectedMember(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, []);

  
  const getStatusColor = (
    status: Member["status"],
  ) => {
    switch (status) {
      case "online":
        return "bg-emerald-500";

      case "idle":
        return "bg-yellow-400";

      case "dnd":
        return "bg-red-500";

      default:
        return "bg-zinc-500";
    }
  };

  
  const getStatusLabel = (
    status: Member["status"],
  ) => {
    switch (status) {
      case "online":
        return "Online";

      case "idle":
        return "Ausente";

      case "dnd":
        return "Não perturbe";

      default:
        return "Offline";
    }
  };

  return (
    <>
      
      
      

      <aside
        className="
          relative
          hidden
          w-60
          shrink-0
          flex-col

          border-l
          border-stone-300
          bg-white

          dark:border-zinc-800/50
          dark:bg-[#111214]

          lg:flex
        "
      >
        <div
          className="
            flex-1
            overflow-y-auto
            p-3
          "
        >
          {groupedMembers.map(
            ({ role, members }) => (
              <section
                key={role.id}
                className="
                  mb-5
                  last:mb-0
                "
              >
                
                
                

                <div
                  className="
                    mb-1.5
                    px-1
                  "
                >
                  <h3
                    className="
                      text-[11px]
                      font-bold
                      uppercase
                      tracking-wide

                      text-stone-500

                      dark:text-zinc-400
                    "
                  >
                    {role.name} —{" "}
                    {members.length}
                  </h3>
                </div>

                
                
                

                <div className="space-y-0.5">
                  {members.map(
                    (member) => (
                      <div
                        key={member.id}
                        onClick={(event) =>
                          openMemberProfile(
                            member,
                            event,
                          )
                        }
                        className="
                          group
                          flex
                          cursor-pointer
                          items-center
                          gap-2.5
                          rounded-md
                          px-2
                          py-1.5
                          transition-colors

                          hover:bg-stone-200

                          dark:hover:bg-zinc-800
                        "
                      >
                        

                        <div
                          className="
                            relative
                            shrink-0
                          "
                        >
                          <img
                            src={
                              member.avatarUrl
                            }
                            alt={
                              member.name
                            }
                            className="
                              h-8
                              w-8
                              rounded-full
                              object-cover
                            "
                          />

                          

                          <span
                            className={`
                              absolute
                              bottom-[-1px]
                              right-[-1px]

                              h-2.5
                              w-2.5

                              rounded-full

                              border-2
                              border-white

                              dark:border-[#111214]

                              ${getStatusColor(
                                member.status,
                              )}
                            `}
                          />
                        </div>

                        

                        <span
                          className="
                            min-w-0
                            flex-1
                            truncate
                            text-sm
                            font-medium

                            text-stone-700

                            dark:text-zinc-300
                          "
                          style={{
                            color:
                              role.color ||
                              undefined,
                          }}
                        >
                          {member.name}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      </aside>

      
      
      

      {selectedMember && (
        <div
          ref={popupRef}
          className="
            fixed
            z-[9999]

            w-[340px]

            overflow-hidden
            rounded-xl

            border

            border-stone-300
            bg-white
            text-stone-900

            shadow-[0_20px_70px_rgba(0,0,0,0.22)]

            dark:border-zinc-700/70
            dark:bg-[#111214]
            dark:text-white
            dark:shadow-[0_20px_70px_rgba(0,0,0,0.65)]
          "
          style={{
            top: popupPosition.top,
            left: popupPosition.left,
          }}
        >
          
          
          

          <div
            className="
              relative
              h-28

              bg-gradient-to-br
              from-indigo-400
              via-purple-400
              to-fuchsia-400

              dark:from-indigo-600
              dark:via-purple-600
              dark:to-fuchsia-600
            "
          >
            <div
              className="
                absolute
                inset-0

                bg-white/10

                dark:bg-black/10
              "
            />

            

            <button
              type="button"
              onClick={() =>
                setSelectedMember(
                  null,
                )
              }
              className="
                absolute
                right-3
                top-3

                flex
                h-8
                w-8
                items-center
                justify-center

                rounded-full

                bg-black/20
                text-white/80
                backdrop-blur-sm

                transition-colors

                hover:bg-black/40
                hover:text-white
              "
            >
              <X
                className="
                  h-4
                  w-4
                "
              />
            </button>
          </div>

          
          
          

          <div
            className="
              relative
              px-4
            "
          >
            
            
            

            <div
              className="
                absolute
                left-4
                -top-12
              "
            >
              <div
                className="
                  relative
                "
              >
                <img
                  src={
                    selectedMember.avatarUrl
                  }
                  alt={
                    selectedMember.name
                  }
                  className="
                    h-20
                    w-20

                    rounded-full

                    border-[6px]
                    border-white

                    bg-stone-200
                    object-cover

                    dark:border-[#111214]
                    dark:bg-zinc-800
                  "
                />

                <span
                  className={`
                    absolute
                    bottom-1
                    right-1

                    h-5
                    w-5

                    rounded-full

                    border-[4px]
                    border-white

                    dark:border-[#111214]

                    ${getStatusColor(
                      selectedMember.status,
                    )}
                  `}
                />
              </div>
            </div>

            
            
            

            <div className="pt-12">
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <h2
                  className="
                    truncate

                    text-xl
                    font-bold

                    text-stone-900

                    dark:text-white
                  "
                >
                  {
                    selectedMember.name
                  }
                </h2>

                <button
                  type="button"
                  className="
                    shrink-0

                    text-stone-400

                    transition-colors

                    hover:text-stone-700

                    dark:text-zinc-500
                    dark:hover:text-white
                  "
                >
                  <MoreHorizontal
                    className="
                      h-5
                      w-5
                    "
                  />
                </button>
              </div>

              <div
                className="
                  text-sm

                  text-stone-500

                  dark:text-zinc-400
                "
              >
                {
                  selectedMember.username
                }
              </div>
            </div>

            
            
            

            <div className="mt-4">
              <div
                className="
                  flex
                  items-center
                  gap-2

                  text-xs
                  font-semibold
                  uppercase

                  text-stone-500

                  dark:text-zinc-400
                "
              >
                <span
                  className={`
                    h-2
                    w-2
                    rounded-full

                    ${getStatusColor(
                      selectedMember.status,
                    )}
                  `}
                />

                {getStatusLabel(
                  selectedMember.status,
                )}
              </div>

              {selectedMember.customStatus && (
                <p
                  className="
                    mt-1

                    text-sm

                    text-stone-600

                    dark:text-zinc-300
                  "
                >
                  {
                    selectedMember.customStatus
                  }
                </p>
              )}
            </div>

            
            
            

            <div
              className="
                my-4
                h-px

                bg-stone-200

                dark:bg-zinc-800
              "
            />

            
            
            

            <div>
              <div
                className="
                  mb-2

                  text-xs
                  font-bold
                  uppercase

                  text-stone-500

                  dark:text-zinc-400
                "
              >
                Roles
              </div>

              <div
                className="
                  flex
                  flex-wrap
                  gap-1.5
                "
              >
                {[
                  ...selectedMember.roles,
                ]
                  .sort(
                    (a, b) =>
                      b.position -
                      a.position,
                  )
                  .map((role) => (
                    <div
                      key={role.id}
                      className="
                        flex
                        items-center
                        gap-1.5

                        rounded-md
                        border

                        border-stone-300
                        bg-stone-100

                        px-2
                        py-1

                        text-xs

                        dark:border-zinc-700
                        dark:bg-zinc-800/70
                      "
                    >
                      <span
                        className="
                          h-2
                          w-2
                          shrink-0
                          rounded-full
                        "
                        style={{
                          backgroundColor:
                            role.color ||
                            "#71717a",
                        }}
                      />

                      <span
                        className="
                          text-stone-700

                          dark:text-zinc-300
                        "
                      >
                        {role.name}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            
            
            

            <div
              className="
                my-4
                h-px

                bg-stone-200

                dark:bg-zinc-800
              "
            />

            
            
            

            <div>
              <div
                className="
                  text-xs
                  font-bold
                  uppercase

                  text-stone-500

                  dark:text-zinc-400
                "
              >
                Membro desde
              </div>

              <div
                className="
                  mt-1
                  text-sm

                  text-stone-600

                  dark:text-zinc-300
                "
              >
                {selectedMember.createdAt ||
                  "21 de agosto de 2026"}
              </div>
            </div>

            
            
            

            <div
              className="
                my-4
                h-px

                bg-stone-200

                dark:bg-zinc-800
              "
            />

            
            
            

            <div className="pb-4">
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                

                <button
                  type="button"
                  className="
                    flex
                    h-10
                    flex-1
                    items-center
                    justify-center
                    gap-2

                    rounded-md

                    bg-zinc-900
                    text-sm
                    font-semibold
                    text-white

                    transition-colors

                    hover:bg-zinc-800

                    dark:bg-white
                    dark:text-black
                    dark:hover:bg-zinc-200
                  "
                >
                  <MessageCircle
                    className="
                      h-4
                      w-4
                    "
                  />

                  Mensagem
                </button>

                

                <button
                  type="button"
                  title="Copiar ID"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      String(
                        selectedMember.id,
                      ),
                    )
                  }
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center

                    rounded-md

                    bg-stone-200
                    text-stone-600

                    transition-colors

                    hover:bg-stone-300
                    hover:text-stone-900

                    dark:bg-zinc-800
                    dark:text-zinc-300
                    dark:hover:bg-zinc-700
                    dark:hover:text-white
                  "
                >
                  <Copy
                    className="
                      h-4
                      w-4
                    "
                  />
                </button>

                

                <button
                  type="button"
                  title="Ver perfil"
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center

                    rounded-md

                    bg-stone-200
                    text-stone-600

                    transition-colors

                    hover:bg-stone-300
                    hover:text-stone-900

                    dark:bg-zinc-800
                    dark:text-zinc-300
                    dark:hover:bg-zinc-700
                    dark:hover:text-white
                  "
                >
                  <CircleUserRound
                    className="
                      h-4
                      w-4
                    "
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}