"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Copy, Gamepad2, GraduationCap, Heart, ImagePlus, Plus, Users } from "lucide-react";
import Modal from "../Modal";
import { createGuild, createGuildFromTemplate } from "@/actions/guilds";
import { acceptGuildInvite } from "@/actions/invites";
import { useRouter } from "next/navigation";

type ModalStep = "options" | "create" | "join";

interface GuildModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GuildModal({ isOpen, onClose }: GuildModalProps) {
  const router = useRouter();
  const [modalStep, setModalStep] = useState<ModalStep>("options");
  const [guildName, setGuildName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setModalStep("options");
      setGuildName("");
      setInviteCode("");
      setTemplateCode("");
    }, 300);
  };

  const handleCreateGuild = async () => {
    const name = guildName.trim();
    if (!name) return;

    try {
      setIsLoading(true);
      // Chama a Server Action para criar no banco e limpar o cache do Redis
      await createGuild(name); 
      handleClose();
      router.refresh(); // Força o Next a pedir os novos dados
    } catch (error) {
      console.error("Erro ao criar guild", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGuild = async () => {
    const invite = inviteCode.trim();
    if (!invite || isLoading) return;

    const code = invite
      .split("/")
      .filter(Boolean)
      .pop()
      ?.trim();

    if (!code) return;

    try {
      setIsLoading(true);
      await acceptGuildInvite(code);
      handleClose();
      router.refresh();
    } catch (error) {
      console.error("Erro ao entrar na guild", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFromTemplate = async () => {
    const code = templateCode.trim();
    if (!code || isLoading) return;

    try {
      setIsLoading(true);
      await createGuildFromTemplate(code, guildName.trim() || undefined);
      handleClose();
      router.refresh();
    } catch (error) {
      console.error("Erro ao criar guild por template", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getModalTitle = () => {
    switch (modalStep) {
      case "create": return "Personalize sua guild";
      case "join": return "Entrar em uma guild";
      default: return "Crie sua guild";
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={getModalTitle()}>
      {modalStep === "options" && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Sua guild é o lugar onde você e seus amigos ficam juntos. Crie uma nova ou entre em uma que já existe.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModalStep("create")}
            className="group flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left transition-all hover:border-indigo-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Plus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Criar minha guild</p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">Começar uma nova comunidade</p>
            </div>
            <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1" />
          </button>

          <div className="px-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
            Comece por um modelo
          </div>

          <div className="space-y-2">
            {[
              { name: "Guild Gamer", icon: Gamepad2, color: "text-indigo-500" },
              { name: "Guild dos Amigos", icon: Heart, color: "text-pink-500" },
              { name: "Grupo de Estudos", icon: GraduationCap, color: "text-emerald-500" },
            ].map((template) => (
              <button
                key={template.name}
                type="button"
                onClick={() => setGuildName(template.name)}
                className="group flex w-full items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-all hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                <template.icon className={`h-5 w-5 ${template.color}`} />
                <span className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">{template.name}</span>
                <ArrowRight className="h-4 w-4 text-zinc-400" />
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <label htmlFor="template-code" className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Código de template
            </label>
            <input
              id="template-code"
              type="text"
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreateFromTemplate(); }}
              placeholder="Cole o código gerado nas configurações"
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-black dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => void handleCreateFromTemplate()}
              disabled={!templateCode.trim() || isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Copy className="h-4 w-4" />
              Criar pelo template
            </button>
          </div>

          <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="mb-2 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300">Já tem um convite?</p>
            <button
              type="button"
              onClick={() => setModalStep("join")}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Users className="h-4 w-4" /> Entrar em uma guild
            </button>
          </div>
        </div>
      )}

      {modalStep === "create" && (
        <div className="space-y-5">
          <div className="text-center">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Dê uma personalidade para sua nova guild com um nome e um ícone.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="group relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-zinc-400 bg-zinc-100 transition-colors hover:border-indigo-500 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-indigo-400 dark:hover:bg-zinc-800"
            >
              <div className="text-center">
                <ImagePlus className="mx-auto h-6 w-6 text-zinc-500 dark:text-zinc-400" />
                <span className="mt-1 block text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">Upload</span>
              </div>
            </button>
          </div>

          <div className="space-y-2">
            <label htmlFor="guild-name" className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Nome da guild <span className="text-red-500">*</span>
            </label>
            <input
              id="guild-name"
              type="text"
              value={guildName}
              onChange={(e) => setGuildName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateGuild(); }}
              placeholder="Nome da sua guild"
              autoFocus
              className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setModalStep("options")}
              className="flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              onClick={handleCreateGuild}
              disabled={!guildName.trim() || isLoading}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <span className="animate-spin text-sm">↻</span> : <Check className="h-4 w-4" />}
              {isLoading ? "Criando..." : "Criar"}
            </button>
          </div>
        </div>
      )}

      {modalStep === "join" && (
        <div className="space-y-5">
           {/* Repita a UI de 'Join' que você forneceu antes, ligando a lógica na `handleJoinGuild` */}
           <div className="text-center">
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">Insira abaixo o convite que recebeu.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="invite-code" className="block text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
              Link do convite <span className="text-red-500">*</span>
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleJoinGuild(); }}
              placeholder="https://sua-url.com/convite/abc123"
              autoFocus
              className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setModalStep("options")}
              className="flex items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="button"
              onClick={() => void handleJoinGuild()}
              disabled={!inviteCode.trim() || isLoading}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="h-4 w-4" />
              <span>{isLoading ? "Entrando..." : "Entrar"}</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
