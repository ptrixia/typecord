"use client";

import { useState } from "react";
import { ImageOff, Loader2, Download, ExternalLink } from "lucide-react";

interface ImagePlayerProps {
    url: string;
    name?: string;
    size?: number;
}

// Função utilitária para formatar o tamanho do arquivo (caso você não tenha uma global)
function formatFileSize(bytes?: number) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ImageAttachment({ url, name = "Imagem", size }: ImagePlayerProps) {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

    return (
        <div className="mt-2 flex w-full max-w-[500px] flex-col gap-1.5">
            {/* CONTAINER DA IMAGEM */}
            <div className="group relative flex min-h-[150px] w-fit max-w-full items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-[#2b2d31]">
                
                {/* ESTADO: CARREGANDO */}
                {status === "loading" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                    </div>
                )}

                {/* ESTADO: ERRO */}
                {status === "error" && (
                    <div className="flex h-[200px] w-[300px] max-w-full flex-col items-center justify-center gap-3 p-4 text-center text-zinc-500 dark:text-zinc-400">
                        <ImageOff className="h-8 w-8 opacity-80" />
                        <span className="text-sm">Falha ao carregar imagem</span>
                    </div>
                )}

                {/* ESTADO: IMAGEM (Oculta enquanto carrega para evitar "pulos" na tela) */}
                {status !== "error" && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`relative block w-full transition-opacity duration-300 ${
                            status === "loading" ? "opacity-0" : "opacity-100"
                        }`}
                    >
                        <img
                            src={url}
                            alt={name}
                            loading="lazy"
                            onLoad={() => setStatus("success")}
                            onError={() => setStatus("error")}
                            className="max-h-[450px] w-auto max-w-full object-contain transition-transform duration-200 group-hover:brightness-95"
                        />
                        
                        {/* OVERLAY DE HOVER (Aparece ao passar o mouse) */}
                        <div className="absolute inset-0 hidden items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
                            <div className="flex items-center gap-2 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                                Abrir Original <ExternalLink className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    </a>
                )}
            </div>

            {/* RODAPÉ: NOME E TAMANHO DO ARQUIVO */}
            <div className="flex items-center gap-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="max-w-[75%] truncate font-medium hover:underline cursor-pointer" title={name}>
                    {name}
                </span>

                {size && (
                    <>
                        <span className="text-zinc-300 dark:text-zinc-600">•</span>
                        <span>{formatFileSize(size)}</span>
                    </>
                )}

                {/* BOTÃO DE DOWNLOAD RÁPIDO */}
                {status === "success" && (
                    <a
                        href={url}
                        download={name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 rounded p-1 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 transition-colors"
                        title="Baixar imagem"
                    >
                        <Download className="h-3.5 w-3.5" />
                    </a>
                )}
            </div>
        </div>
    );
}