"use client";

import { useEffect, useState } from "react";
import { Plus, Compass } from "lucide-react";

import GuildIcon from "../Guild/GuildIcon";
import DirectMessagesIcon from "../DirectMessages/DirectMessagesIcon";
import GuildModal from "./GuildModal";
import DiscoverModal from "./DiscoverModal";
import { PartialGuild } from "@/actions/guilds";
import { onGatewayEvent } from "@/lib/realtime/gateway-client";

interface SidebarClientProps {
  initialGuilds: PartialGuild[];
}

export default function SidebarClient({ initialGuilds }: SidebarClientProps) {
  const [guilds, setGuilds] = useState(initialGuilds);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [isDiscoverModalOpen, setIsDiscoverModalOpen] = useState(false);

  useEffect(() => {
    setGuilds(initialGuilds);
  }, [initialGuilds]);

  useEffect(() => {
    const removeCreate = onGatewayEvent<any>("GUILD_CREATE", ({ data }) => {
      const guild = data?.guild ?? data;

      if (!guild?.id) {
        return;
      }

      setGuilds((current) => {
        if (current.some((item) => String(item.id) === String(guild.id))) {
          return current;
        }

        return [
          ...current,
          {
            id: String(guild.id),
            name: String(guild.name ?? "Servidor"),
            iconUrl: guild.iconUrl ?? null,
          },
        ];
      });
    });

    const removeUpdate = onGatewayEvent<any>("GUILD_UPDATE", ({ data }) => {
      const guild = data?.guild ?? data;

      if (!guild?.id) {
        return;
      }

      setGuilds((current) =>
        current.map((item) =>
          String(item.id) === String(guild.id)
            ? {
                ...item,
                name: String(guild.name ?? item.name),
                iconUrl: guild.iconUrl ?? item.iconUrl,
              }
            : item,
        ),
      );
    });

    const removeDelete = onGatewayEvent<any>("GUILD_DELETE", ({ data }) => {
      const guildId = String(data?.guildId ?? data?.id ?? "");

      if (!guildId) {
        return;
      }

      setGuilds((current) =>
        current.filter((item) => String(item.id) !== guildId),
      );
    });

    return () => {
      removeCreate();
      removeUpdate();
      removeDelete();
    };
  }, []);

  return (
    <>
      <div
        className="
          m-1 flex h-full w-full max-w-24 flex-col items-center
          rounded-t-3xl bg-white py-3 font-sans dark:bg-black
        "
      >
        <DirectMessagesIcon />

        <div
          className="
            my-2 h-[2px] w-8 shrink-0 rounded-full bg-zinc-300
            dark:bg-zinc-800
          "
        />

        <div
          className="
            flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto
            [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          "
        >
          {guilds.map((guild) => (
            <GuildIcon key={guild.id} guild={guild} />
          ))}

          <button
            type="button"
            onClick={() => setIsGuildModalOpen(true)}
            title="Adicionar uma guild"
            className="
              group flex h-12 w-12 shrink-0 items-center justify-center
              rounded-full border border-dashed border-zinc-300
              bg-zinc-100 text-zinc-500 transition-all duration-200
              hover:scale-105 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white
              dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400
              dark:hover:border-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white
            "
          >
            <Plus className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90" />
          </button>

          <button
            type="button"
            onClick={() => setIsDiscoverModalOpen(true)}
            title="Descobrir servidores"
            className="
              group flex h-12 w-12 shrink-0 items-center justify-center
              rounded-full bg-zinc-100 text-zinc-500 transition-all duration-200
              hover:scale-105 hover:bg-indigo-500 hover:text-white
              dark:bg-zinc-900 dark:text-zinc-400
              dark:hover:bg-indigo-500 dark:hover:text-white
            "
          >
            <Compass className="h-6 w-6 transition-transform duration-200" />
          </button>

        </div>
      </div>

      <GuildModal
        isOpen={isGuildModalOpen}
        onClose={() => setIsGuildModalOpen(false)}
      />

      <DiscoverModal
        isOpen={isDiscoverModalOpen}
        onClose={() => setIsDiscoverModalOpen(false)}
      />
    </>
  );
}
