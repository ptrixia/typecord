"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useChat,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Users, PhoneOff, MessageSquare, Send } from "lucide-react";
import ClientTime from "./ClientTime";

interface VoiceRoomProps {
  roomName: string;
  userName: string;
  token: string;
  onLeave: () => void;
  channelName: string;
}

export default function VoiceRoom({ roomName, userName, token, onLeave, channelName }: VoiceRoomProps) {
  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ height: "100%", width: "100%" }}
      onDisconnected={onLeave}
    >
      <VoiceRoomContent channelName={channelName} onLeave={onLeave} />
    </LiveKitRoom>
  );
}

function VoiceRoomContent({ channelName, onLeave }: { channelName: string; onLeave: () => void }) {
  const [activeTab, setActiveTab] = useState<"members" | "chat">("members");

  return (
    <div className="flex h-full w-full flex-col bg-[#313338] text-white select-none">
      
      {/* HEADER DO CANAL DE VOZ */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#202225] px-4 shadow-sm bg-[#2b2d31]">
        <div className="flex items-center gap-2 font-semibold text-sm text-zinc-200">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{channelName}</span>
        </div>

        {/* Abas para alternar entre Lista de Membros e Chat na direita (estilo Discord) */}
        <div className="flex items-center gap-2 bg-[#1e1f22] p-1 rounded-md">
          <button
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "members" ? "bg-[#35373c] text-white shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Conectados
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              activeTab === "chat" ? "bg-[#35373c] text-white shadow" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Chat da Call
          </button>
        </div>

        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 rounded bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500 hover:text-white"
        >
          <PhoneOff className="h-3.5 w-3.5" /> Desconectar
        </button>
      </div>

      {/* CORPO PRINCIPAL */}
      <div className="flex flex-1 overflow-hidden p-3 gap-3">
        
        {/* GRADE DE VÍDEOS / TELAS */}
        <div className="flex-1 rounded-lg overflow-hidden bg-[#111214] relative flex flex-col p-3 border border-[#202225] shadow-inner">
          <DiscordGridLayout />

          {/* BARRA DE CONTROLE INFERIOR */}
          <div className="mt-3 flex items-center justify-center bg-[#2b2d31] rounded-xl p-2 border border-zinc-800 shadow-lg">
            <ControlBar 
              controls={{
                microphone: true,
                camera: true,
                screenShare: true,
                chat: false,
                settings: false,
              }} 
            />
          </div>
        </div>

        {/* PAINEL LATERAL DIREITO (Alterna entre Membros e Chat de Texto) */}
        <div className="w-72 shrink-0 flex flex-col bg-[#2b2d31] rounded-lg border border-[#202225] shadow-md overflow-hidden">
          {activeTab === "members" ? (
            <div className="flex flex-col h-full p-3">
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-zinc-700/50 font-bold text-xs text-zinc-400 uppercase tracking-wider">
                <Users className="h-4 w-4 text-emerald-500" />
                <span>Conectados</span>
              </div>
              <ConnectedParticipantsList />
            </div>
          ) : (
            <VoiceChatPanel />
          )}
        </div>
      </div>

      <RoomAudioRenderer />
    </div>
  );
}

// Grade inteligente (sem duplicações)
function DiscordGridLayout() {
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: true }
  );

  const participants = useParticipants();
  const screenShares = tracks.filter((t) => t?.publication?.source === Track.Source.ScreenShare);

  return (
    <div className="flex-1 w-full h-full flex flex-col gap-2 overflow-y-auto">
      {screenShares.length > 0 ? (
        <div className="flex flex-col h-full gap-2">
          <div className="flex-1 bg-black rounded-lg overflow-hidden relative flex items-center justify-center border border-zinc-800">
            <video
              ref={(node) => {
                if (node && screenShares[0]?.publication?.track) {
                  screenShares[0].publication.track.attach(node);
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded text-xs font-medium text-white flex items-center gap-1.5">
              <span>🖥️ {screenShares[0]?.participant?.identity || "Participante"} (Tela)</span>
            </div>
          </div>

          <div className="flex h-28 gap-2 overflow-x-auto">
            {participants.map((participant) => (
              <ParticipantUniqueCard key={participant.sid} participant={participant} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 h-full items-center justify-center p-2">
          {participants.map((participant) => (
            <ParticipantUniqueCard key={participant.sid} participant={participant} />
          ))}
        </div>
      )}
    </div>
  );
}


function ParticipantUniqueCard({ participant }: { participant: any }) {
  const cameraTrackPub = participant.getTrackPublication(Track.Source.Camera);
  const isCameraActive = cameraTrackPub && cameraTrackPub.isSubscribed && !cameraTrackPub.isMuted;
  
  const hasAudio = participant.isMicrophoneEnabled;
  const identityName = participant.identity || "Usuário";

  return (
    <div className="relative flex flex-col items-center justify-center bg-[#1e1f22] rounded-lg overflow-hidden border border-[#2b2d31] h-full min-h-[160px] shadow-md group">
      {isCameraActive && cameraTrackPub?.track ? (
        <video
          ref={(node) => {
            if (node && cameraTrackPub.track) {
              cameraTrackPub.track.attach(node);
            }
          }}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className={`relative h-20 w-20 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white uppercase shadow-lg transition-transform ${hasAudio ? "ring-4 ring-emerald-500/70" : ""}`}>
            {identityName.charAt(0)}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-md text-xs font-semibold text-white flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${hasAudio ? "bg-emerald-500" : "bg-zinc-500"}`} />
        <span className="truncate max-w-[120px]">{identityName}</span>
      </div>
    </div>
  );
}

function ConnectedParticipantsList() {
  const participants = useParticipants();

  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {participants?.map((p, idx) => {
        const name = p?.identity || "Usuário";
        const key = p?.sid ?? `participant-${idx}`;
        return (
          <div key={key} className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-zinc-700/35 transition-colors">
            <div className="relative">
              <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold text-xs uppercase text-white overflow-hidden shadow">
                {name.charAt(0)}
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#2b2d31]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{name}</p>
              <p className="text-[10px] text-zinc-400">Canal de Voz</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VoiceChatPanel() {
  const { chatMessages, send } = useChat();
  const [message, setMessage] = useState("");

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    await send(message);
    setMessage("");
  };

  return (
    <div className="flex flex-col h-full bg-[#2b2d31]">
      <div className="flex items-center gap-2 p-3 border-b border-zinc-700/50 font-bold text-xs text-zinc-400 uppercase tracking-wider">
        <MessageSquare className="h-4 w-4 text-indigo-400" />
        <span>Chat da Call</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-zinc-500 text-center px-4">
            Nenhuma mensagem ainda. Envie algo para começar a conversar no canal de voz!
          </div>
        ) : (
          chatMessages.map((msg, idx) => (
            <div key={idx} className="flex flex-col text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-indigo-400">{msg.from?.identity || "Usuário"}</span>
                <span className="text-[10px] text-zinc-500">
                  <ClientTime timestamp={msg.timestamp} />
                </span>
              </div>
              <p className="text-zinc-300 mt-0.5 break-words">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-700/50 bg-[#2b2d31]">
        <div className="flex items-center bg-[#383a40] rounded-md px-3 py-2 border border-zinc-700 focus-within:border-indigo-500">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enviar mensagem..."
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-zinc-500"
          />
          <button type="submit" className="text-zinc-400 hover:text-white transition-colors ml-2">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}