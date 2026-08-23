"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Gamepad2, GraduationCap, Heart, ImagePlus, Plus, Users } from "lucide-react";
import GuildIcon from "./Guild/GuildIcon";
import DirectMessagesIcon from "./DirectMessages/DirectMessagesIcon";
import Modal from "./Modal";

type ModalStep = "options" | "create" | "join";

interface Guild {
  id: number | string;
  name: string;
  iconUrl?: string | null; 
}

const TEMPLATES = [
  { name: "Guild Gamer", label: "Gaming", Icon: Gamepad2, color: "text-indigo-500" },
  { name: "Guild dos Amigos", label: "Amigos", Icon: Heart, color: "text-pink-500" },
  { name: "Grupo de Estudos", label: "Grupo de estudos", Icon: GraduationCap, color: "text-emerald-500" },
];

export default function Sidebar({ initialGuilds }: { initialGuilds: Guild[] }) {
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("options");
  const [guildName, setGuildName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [guilds, setGuilds] = useState<Guild[]>(initialGuilds || []);

  const openGuildModal = () => {
    setModalStep("options");
    setGuildName("");
    setInviteCode("");
    setIsGuildModalOpen(true);
  };

  const closeGuildModal = () => {
    setIsGuildModalOpen(false);
    setModalStep("options");
  };

  const handleCreateGuild = () => {
    if (!guildName.trim()) return;
    setGuilds((prev) => [...prev, { id: Date.now(), name: guildName.trim(), iconUrl: null }]);
    closeGuildModal();
  };

  const handleJoinGuild = () => {
    if (!inviteCode.trim()) return;
    setGuilds((prev) => [...prev, { id: Date.now(), name: "Guild convidada", iconUrl: null }]);
    closeGuildModal();
  };

  const modalTitles = {
    create: "Personalize sua guild",
    join: "Entrar em uma guild",
    options: "Crie sua guild",
  };

  return (
    <>
      <div className="m-1 flex h-full w-full max-w-24 flex-col items-center rounded-t-3xl bg-white py-3 font-sans dark:bg-black">
        <DirectMessagesIcon />
        
        <div className="my-2 h-[2px] w-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-800" />

        <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {guilds.map((guild) => (
            <GuildIcon key={guild.id} guild={guild} />
          ))}

          <button
            type="button"
            onClick={openGuildModal}
            title="Adicionar uma guild"
            className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-100 text-zinc-500 transition-all duration-200 hover:scale-105 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white"
          >
            <Plus className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90" />
          </button>
        </div>
      </div>

      <Modal isOpen={isGuildModalOpen} onClose={closeGuildModal} title={modalTitles[modalStep]}>
        
        {/* TELA DE OPÇÕES */}
        {modalStep === "options" && (
          <div className="space-y-4">
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Sua guild é o lugar onde você e seus amigos ficam juntos. Crie uma nova ou entre em uma que já existe.
            </p>

            <button
              onClick={() => setModalStep("create")}
              className="group flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition-all hover:border-indigo-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <Plus className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Criar minha guild</p>
                <p className="mt-0.5 text-xs text-zinc-500">Começar uma nova comunidade</p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1" />
            </button>

            <div className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              Comece por um modelo
            </div>

            <div className="space-y-2">
              {TEMPLATES.map(({ name, label, Icon, color }) => (
                <button
                  key={name}
                  onClick={() => setGuildName(name)}
                  className="group flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <Icon className={`h-5 w-5 ${color}`} />
                  <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                  <ArrowRight className="h-4 w-4 text-zinc-400" />
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">Já tem um convite?</p>
              <button
                onClick={() => setModalStep("join")}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <Users className="h-4 w-4" /> Entrar em uma guild
              </button>
            </div>
          </div>
        )}

        {/* TELA DE CRIAR GUILD */}
        {modalStep === "create" && (
          <div className="space-y-5">
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Dê uma personalidade para sua nova guild com um nome e um ícone. Você poderá alterar isso depois.
            </p>

            <div className="flex justify-center">
              <button className="group relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-zinc-400 bg-zinc-100 transition-colors hover:border-indigo-500 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-400 dark:hover:bg-zinc-800">
                <div className="text-center">
                  <ImagePlus className="mx-auto h-6 w-6 text-zinc-500 dark:text-zinc-400" />
                  <span className="mt-1 block text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Upload</span>
                </div>
                <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white shadow-md">
                  <Plus className="h-4 w-4" />
                </div>
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="guild-name" className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
                Nome da guild <span className="text-red-500">*</span>
              </label>
              <input
                id="guild-name"
                value={guildName}
                onChange={(e) => setGuildName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGuild()}
                placeholder="Nome da sua guild"
                autoFocus
                className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Ao criar uma guild, você poderá adicionar canais e convidar amigos.</p>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button onClick={() => setModalStep("options")} className="flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button onClick={handleCreateGuild} disabled={!guildName.trim()} className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                <Check className="h-4 w-4" /> Criar
              </button>
            </div>
          </div>
        )}

        {/* TELA DE ENTRAR EM GUILD */}
        {modalStep === "join" && (
          <div className="space-y-5">
            <p className="text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Insira abaixo o convite que recebeu para entrar em uma guild existente.
            </p>

            <div className="space-y-2">
              <label htmlFor="invite-code" className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
                Link do convite <span className="text-red-500">*</span>
              </label>
              <input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinGuild()}
                placeholder="https://typecord.com/convite/abc123"
                autoFocus
                className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <p className="text-xs text-zinc-500">Os convites normalmente têm este formato:</p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">abc123</span>
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">convite/abc123</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Não tem um convite?</p>
                <p className="mt-0.5 text-xs text-zinc-500">Peça ao administrador da guild para enviar um link.</p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <button onClick={() => setModalStep("options")} className="flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button onClick={handleJoinGuild} disabled={!inviteCode.trim()} className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                <Users className="h-4 w-4" /> Entrar na guild
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}