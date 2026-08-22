"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal"; // Ajuste o caminho para onde está o seu Modal

export default function SearchCommand() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Verifica se CTRL (Windows/Linux) ou META (Mac) está pressionado junto com a tecla 'k'
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); // Evita que o navegador foque na barra de pesquisa padrão
        setIsOpen((open) => !open); // Alterna o modal entre aberto/fechado
      }
    };

    // Adiciona o listener no documento inteiro
    document.addEventListener("keydown", handleKeyDown);
    
    // Limpa o listener quando o componente for desmontado para evitar vazamento de memória
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Botão opcional para o usuário clicar caso não queira usar o atalho */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-4 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-200 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <span>Buscar no Typecord...</span>
        <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Renderiza o seu Modal passando o estado */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Busca Rápida"
      >
        <div className="mt-4 flex flex-col gap-4">
          <input
            type="text"
            placeholder="Para onde você quer ir?"
            autoFocus // Foca automaticamente no input quando o modal abre
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:text-zinc-50 dark:focus:border-blue-500"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Comece a digitar para buscar canais, servidores ou configurações.
          </p>
        </div>
      </Modal>
    </>
  );
}