"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";

import Modal from "@/components/Modal";
import type {
  DirectConversationSummary,
  DirectMessagesBootstrap,
  DirectUser,
} from "@/types/direct-messages";
import AddFriendModal from "./AddFriendModal";
import CreateGroupModal from "./CreateGroupModal";
import DirectMessageChat from "./DirectMessageChat";
import DirectMessageMembers from "./DirectMessageMembers";
import DirectMessagesList from "./DirectMessagesList";
import FriendsPanel from "./FriendsPanel";
import NewConversationModal from "./NewConversationModal";
import UserProfileModal from "./UserProfileModal";

export default function DirectMessagesLayout() {
  const [isMounted, setIsMounted] = useState(false);
  const [data, setData] = useState<DirectMessagesBootstrap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [friendsSelected, setFriendsSelected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<DirectUser | null>(null);
  const [closeConversation, setCloseConversation] =
    useState<DirectConversationSummary | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadBootstrap = useCallback(
    async (preferredConversationId?: string | null) => {
      try {
        setFatalError("");

        const response = await fetch("/api/direct-messages/bootstrap", {
          cache: "no-store",
        });
        const body = await response.json();

        if (!response.ok || !body.success || !body.data) {
          throw new Error(
            body.message || "Não foi possível carregar as mensagens diretas.",
          );
        }

        const nextData = body.data as DirectMessagesBootstrap;
        setData(nextData);

        const idToKeep = preferredConversationId ?? selectedId;

        if (idToKeep) {
          const stillExists = nextData.conversations.some(
            (conversation) => conversation.id === idToKeep,
          );

          if (!stillExists) {
            setSelectedId(null);
            setFriendsSelected(true);
          }
        }
      } catch (error) {
        setFatalError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as mensagens diretas.",
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedId],
  );

  useEffect(() => {
    if (isMounted) {
      loadBootstrap();
    }
  }, [isMounted, loadBootstrap]);

  const selectedConversation = useMemo(
    () =>
      data?.conversations.find(
        (conversation) => conversation.id === selectedId,
      ) ?? null,
    [data?.conversations, selectedId],
  );

  const pendingCount =
    data?.relationships.filter(
      (relationship) =>
        relationship.type === "PENDING" &&
        relationship.direction === "incoming",
    ).length ?? 0;

  const profileRelationship =
    profileUser && data
      ? data.relationships.find(
          (relationship) =>
            relationship.otherUser.id === profileUser.id,
        ) ?? null
      : null;

  async function refresh() {
    await loadBootstrap(selectedId);
  }

  async function startDm(userId: string) {
    const response = await fetch("/api/direct-messages/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "DM",
        userId,
      }),
    });

    const body = await response.json();

    if (!response.ok || !body.success || !body.conversation) {
      throw new Error(body.message || "Não foi possível abrir a conversa.");
    }

    const conversation =
      body.conversation as DirectConversationSummary;

    setSelectedId(conversation.id);
    setFriendsSelected(false);
    setProfileUser(null);
    await loadBootstrap(conversation.id);
  }

  async function handleCreated(
    conversation: DirectConversationSummary,
  ) {
    setSelectedId(conversation.id);
    setFriendsSelected(false);
    await loadBootstrap(conversation.id);
  }

  async function hideDm() {
    if (!closeConversation) return;

    try {
      setClosing(true);

      const response = await fetch(
        `/api/direct-messages/conversations/${closeConversation.id}`,
        {
          method: "DELETE",
        },
      );
      const body = await response.json();

      if (!response.ok || !body.success) {
        throw new Error(body.message || "Não foi possível fechar a conversa.");
      }

      if (selectedId === closeConversation.id) {
        setSelectedId(null);
        setFriendsSelected(true);
      }

      setCloseConversation(null);
      await loadBootstrap(null);
    } catch (error) {
      setFatalError(
        error instanceof Error
          ? error.message
          : "Não foi possível fechar a conversa.",
      );
    } finally {
      setClosing(false);
    }
  }

  async function handleConversationRemoved() {
    setSelectedId(null);
    setFriendsSelected(true);
    await loadBootstrap(null);
  }

  if (!isMounted || (loading && !data)) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-white dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
          <span className="text-xs font-medium">
            Carregando mensagens diretas...
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-white p-6 dark:bg-zinc-950">
        <div className="max-w-md rounded-xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
          <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-rose-500" />
          <h2 className="font-bold text-zinc-950 dark:text-white">
            Não foi possível abrir as mensagens diretas
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {fatalError || "Tente novamente."}
          </p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              loadBootstrap();
            }}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-w-0 flex-1 overflow-hidden bg-white dark:bg-zinc-950 rounded-t-3xl mt-3 mr-2">
        <DirectMessagesList
          conversations={data.conversations}
          currentUser={data.currentUser}
          selectedId={selectedId}
          friendsSelected={friendsSelected}
          pendingCount={pendingCount}
          onSelect={(id) => {
            setSelectedId(id);
            setFriendsSelected(false);
          }}
          onFriends={() => {
            setSelectedId(null);
            setFriendsSelected(true);
          }}
          onNewMessage={() => setNewMessageOpen(true)}
          onCreateGroup={() => setCreateGroupOpen(true)}
          onAddFriend={() => setAddFriendOpen(true)}
          onOpenProfile={setProfileUser}
          onCloseConversation={(conversation) => {
            if (conversation.type === "DM") {
              setCloseConversation(conversation);
            }
          }}
        />

        {friendsSelected || !selectedConversation ? (
          <FriendsPanel
            relationships={data.relationships}
            onOpenProfile={setProfileUser}
            onStartDm={startDm}
            onChanged={refresh}
            onAddFriend={() => setAddFriendOpen(true)}
          />
        ) : (
          <>
            <DirectMessageChat
              conversation={selectedConversation}
              currentUser={data.currentUser}
              relationships={data.relationships}
              onOpenProfile={setProfileUser}
              onChanged={refresh}
              onConversationRemoved={handleConversationRemoved}
            />
            <DirectMessageMembers
              conversation={selectedConversation}
              onOpenProfile={setProfileUser}
            />
          </>
        )}
      </div>

      <NewConversationModal
        isOpen={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        onCreated={handleCreated}
        onOpenProfile={setProfileUser}
        onRelationshipsChanged={refresh}
        onCreateGroup={() => setCreateGroupOpen(true)}
      />

      <CreateGroupModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        relationships={data.relationships}
        onCreated={handleCreated}
      />

      <AddFriendModal
        isOpen={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
        onChanged={refresh}
      />

      <UserProfileModal
        isOpen={Boolean(profileUser)}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        currentUserId={data.currentUser.id}
        relationship={profileRelationship}
        onStartDm={startDm}
        onRelationshipsChanged={refresh}
      />

      <Modal
        isOpen={Boolean(closeConversation)}
        onClose={() => setCloseConversation(null)}
        title="Fechar mensagem direta?"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
            <p className="text-zinc-600 dark:text-zinc-400">
              A conversa com{" "}
              <strong>{closeConversation?.displayName}</strong> será removida
              da sua lista. O histórico não será apagado e a conversa volta a
              aparecer quando uma nova mensagem for enviada.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCloseConversation(null)}
              className="rounded-md px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={closing}
              onClick={hideDm}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {closing ? "Fechando..." : "Fechar conversa"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}