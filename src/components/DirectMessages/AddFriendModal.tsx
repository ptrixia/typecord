"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";

import Modal from "@/components/Modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
};

export default function AddFriendModal({
  isOpen,
  onClose,
  onChanged,
}: Props) {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setUsername("");
      setMessage(null);
      setLoading(false);
    }
  }, [isOpen]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const normalized = username.trim().replace(/^@/, "");

    if (!normalized) return;

    try {
      setLoading(true);
      setMessage(null);

      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "request",
          username: normalized,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível enviar a solicitação.");
      }

      setMessage({
        type: "success",
        text: data.message || "Solicitação enviada.",
      });
      setUsername("");
      await onChanged();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a solicitação.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar amigo"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
          Digite o nome de usuário exato. Você também pode começar com
          <span className="font-semibold"> @</span>.
        </p>

        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 p-2 focus-within:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900">
          <UserPlus className="h-5 w-5 shrink-0 text-zinc-500" />
          <input
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="@username"
            maxLength={64}
            className="h-9 min-w-0 flex-1 bg-transparent px-1 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar solicitação"}
          </button>
        </div>

        {message && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              message.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            }`}
          >
            {message.text}
          </div>
        )}
      </form>
    </Modal>
  );
}