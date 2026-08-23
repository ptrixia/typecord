import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#404EED] dark:bg-[#1E1F22] text-white flex flex-col transition-colors duration-300 selection:bg-white selection:text-[#404EED]">
      
      {/* Header / Navegação */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-wider uppercase">TYPECORD</span>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            href="/login"
            className="bg-white dark:bg-[#5865F2] text-[#23272A] dark:text-white px-5 py-2.5 rounded-full font-medium text-sm hover:shadow-lg hover:opacity-90 transition-all duration-200"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12 relative overflow-hidden">
        
        {/* Detalhes visuais de fundo inspirados no estilo Discord */}
        <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-5 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="max-w-4xl mx-auto z-10 flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-none">
            IMAGINE UM LUGAR...
          </h1>
          
          <p className="text-lg md:text-xl text-gray-100 dark:text-[#B5BAC1] max-w-2xl mb-10 leading-relaxed">
            ...onde você possa pertencer a um clube escolar, um grupo de gamers ou uma comunidade de arte mundial. Um lugar onde você e seus amigos possam passar o tempo juntos todos os dias.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white text-[#23272A] hover:bg-gray-100 px-8 py-4 rounded-full font-bold text-base shadow-2xl transition-all transform hover:-translate-y-0.5 duration-200 text-center"
            >
              Criar conta e conversar
            </Link>
          </div>
        </div>
      </main>

      {/* Seção de Recursos Rápidos */}
      <section className="bg-white dark:bg-[#2B2D31] text-[#23272A] dark:text-[#DBDEE1] py-20 px-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
          
          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#5865F2]/10 dark:bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] font-bold text-xl">
              💬
            </div>
            <h3 className="text-xl font-bold">Canais debaixo de controle</h3>
            <p className="text-gray-600 dark:text-[#949BA4] text-sm leading-relaxed">
              Canais de texto fáceis de usar onde vocês podem conversar sem bagunçar o chat geral. Envie imagens, emojis e muito mais.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#5865F2]/10 dark:bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] font-bold text-xl">
              🎙️
            </div>
            <h3 className="text-xl font-bold">Onde é fácil entrar</h3>
            <p className="text-gray-600 dark:text-[#949BA4] text-sm leading-relaxed">
              Entre em um canal de voz quando estiver livre. Amigos no seu servidor podem ver que você está lá e entrar conversando na mesma hora.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#5865F2]/10 dark:bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2] font-bold text-xl">
              🛡️
            </div>
            <h3 className="text-xl font-bold">Para poucos e para muitos</h3>
            <p className="text-gray-600 dark:text-[#949BA4] text-sm leading-relaxed">
              Crie comunidades customizadas com cargos, permissões granulares e total segurança para os seus membros.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#23272A] text-white py-8 px-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="font-bold tracking-wider">TYPECORD</div>
          <p className="text-gray-400 text-xs">
            &copy; {new Date().getFullYear()} Typecord. Todos os direitos reservados.
          </p>
        </div>
      </footer>

    </div>
  );
}