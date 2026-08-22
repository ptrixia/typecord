import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  Download,
  Hash,
  MessageCircle,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  Video,
  Waves,
} from "lucide-react";

const channels = ["geral", "criadores", "design", "off-topic"];

const members = [
  { name: "Marina Costa", role: "online agora", color: "bg-[#f37d67]" },
  { name: "Rafael Lima", role: "criando um projeto", color: "bg-[#6c8df5]" },
  { name: "Bia Martins", role: "ouvindo música", color: "bg-[#e7b35d]" },
];

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#f6f7f9] text-[#111827] selection:bg-[#cbd7ff]">

      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Typecord início">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111827] text-white">
            <MessageCircle size={21} strokeWidth={2.5} />
          </span>
          <span className="text-[18px] font-black tracking-[0.12em]">TYPECORD</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-semibold text-[#6b7280] lg:flex">
          <Link href="#produto" className="transition-colors hover:text-[#111827]">Produto</Link>
          <Link href="#comunidades" className="transition-colors hover:text-[#111827]">Comunidades</Link>
          <Link href="#seguranca" className="transition-colors hover:text-[#111827]">Segurança</Link>
          <Link href="#download" className="flex items-center gap-1 transition-colors hover:text-[#111827]">Download <ChevronDown size={14} /></Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="hidden text-[13px] font-semibold text-[#6b7280] hover:text-[#111827] sm:block">Entrar</Link>
          <Link href="/app" className="rounded-lg bg-[#111827] px-5 py-3 text-[13px] font-bold text-white transition-colors hover:bg-[#273247]">Abrir Typecord</Link>
        </div>
      </header>

      <main id="download" className="relative z-10 mx-auto max-w-7xl px-6 pb-20 pt-10 lg:px-10 lg:pt-20">
        <section className="grid items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div className="max-w-xl animate-fade-up">
            <div className="mb-7 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#5268d8]">
              <Sparkles size={14} /> Feito para as suas pessoas
            </div>
            <h1 className="max-w-[620px] text-[clamp(3.5rem,7vw,6.5rem)] font-black leading-[0.92] tracking-[-0.07em] text-[#111827]">
              O lugar onde<br /><span className="text-[#5268d8]">as ideias</span><br />se encontram.
            </h1>
            <p className="mt-8 max-w-md text-[17px] leading-7 text-[#687186]">
              Conversas que fluem, comunidades que crescem. O Typecord junta texto, voz e vídeo em um espaço simples de chamar de seu.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/app" className="flex items-center justify-center gap-2 rounded-lg bg-[#5268d8] px-6 py-4 text-[14px] font-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#4056c4]">
                Começar agora <ArrowRight size={17} />
              </Link>
              <Link href="#download" className="flex items-center justify-center gap-2 rounded-lg border border-[#d8dce5] bg-white px-6 py-4 text-[14px] font-black text-[#111827] transition-colors hover:bg-[#f0f2f6]">
                <Download size={17} /> Baixar para desktop
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-[12px] font-bold text-[#8b92a1]">
              <span className="flex -space-x-2">
                {members.map((member) => <span key={member.name} className={`h-7 w-7 rounded-full border-2 border-[#f6f7f9] ${member.color}`} />)}
              </span>
              <span><strong className="text-[#17213b]">1.200+</strong> pessoas já estão conversando</span>
            </div>
          </div>

          <div id="produto" className="relative animate-fade-up [animation-delay:120ms]">
            <div className="relative overflow-hidden rounded-2xl border border-[#d7dbe4] bg-[#202a46] shadow-[0_20px_60px_rgba(28,39,69,0.16)]">
              <div className="flex h-12 items-center justify-between border-b border-white/10 bg-[#18213a] px-4 text-white">
                <div className="flex items-center gap-2 text-[12px] font-bold"><span className="h-2.5 w-2.5 rounded-full bg-[#7fd1b7]" /> The Cozy Club <ChevronDown size={13} className="text-white/40" /></div>
                <div className="flex gap-3 text-white/45"><Search size={15} /><Settings size={15} /></div>
              </div>
              <div className="grid min-h-[390px] grid-cols-[145px_1fr] sm:grid-cols-[175px_1fr_140px]">
                <aside className="border-r border-white/10 bg-[#202a46] p-3 text-white/70">
                  <div className="mb-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Canais <Plus size={13} /></div>
                  <div className="space-y-1">
                    {channels.map((channel, index) => <div key={channel} className={`flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] font-bold ${index === 0 ? "bg-white/10 text-white" : "hover:bg-white/5"}`}><Hash size={14} className="text-white/35" />{channel}</div>)}
                  </div>
                  <div className="mt-8 rounded-xl bg-[#2b385b] p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-black text-white"><AudioLines size={13} className="text-[#7fd1b7]" /> Sala de voz</div><div className="text-[9px] text-white/45">3 pessoas conectadas</div></div>
                </aside>
                <div className="flex min-w-0 flex-col bg-[#f8f6f2]">
                  <div className="flex items-center justify-between border-b border-[#e6e2db] px-5 py-4"><div className="flex items-center gap-2 font-black text-[#17213b]"><Hash size={17} className="text-[#9ba2af]" /> geral</div><div className="flex gap-3 text-[#a7acb7]"><Users size={16} /><Video size={16} /></div></div>
                  <div className="flex-1 space-y-5 p-5">
                    <div className="flex gap-3"><span className="h-8 w-8 shrink-0 rounded-full bg-[#e7b35d]" /><div><div className="flex items-baseline gap-2"><strong className="text-[11px] text-[#17213b]">Bia Martins</strong><span className="text-[9px] text-[#a6a9b1]">09:42</span></div><p className="mt-1 text-[11px] leading-5 text-[#687186]">Alguém viu a nova atualização? Ficou linda demais ✨</p></div></div>
                    <div className="flex gap-3"><span className="h-8 w-8 shrink-0 rounded-full bg-[#6c8df5]" /><div><div className="flex items-baseline gap-2"><strong className="text-[11px] text-[#17213b]">Rafael Lima</strong><span className="text-[9px] text-[#a6a9b1]">09:44</span></div><p className="mt-1 text-[11px] leading-5 text-[#687186]">Sim! A parte de comunidades está muito mais rápida.</p><div className="mt-2 rounded-lg border border-[#e5e1da] bg-white p-3 text-[10px] text-[#687186]"><div className="mb-2 h-2 w-2/3 rounded-full bg-[#dce3f7]" /><div className="h-2 w-1/2 rounded-full bg-[#edf0f5]" /></div></div></div>
                    <div className="flex gap-3"><span className="h-8 w-8 shrink-0 rounded-full bg-[#f37d67]" /><div><div className="flex items-baseline gap-2"><strong className="text-[11px] text-[#17213b]">Marina Costa</strong><span className="text-[9px] text-[#a6a9b1]">09:45</span></div><p className="mt-1 text-[11px] leading-5 text-[#687186]">Bora testar em call depois? 🎧</p></div></div>
                  </div>
                  <div className="m-4 flex items-center gap-2 rounded-lg bg-[#eeece8] px-3 py-3 text-[10px] text-[#a4a8b1]"><Plus size={15} /> Enviar uma mensagem em #geral</div>
                </div>
                <aside className="hidden border-l border-[#e6e2db] bg-[#f2f0ec] p-4 sm:block"><div className="mb-4 text-[9px] font-black uppercase tracking-[0.14em] text-[#a0a5af]">Online — 3</div>{members.map((member) => <div key={member.name} className="mb-4 flex items-center gap-2"><span className={`h-7 w-7 rounded-full ${member.color}`} /><div><div className="text-[10px] font-black text-[#35405c]">{member.name}</div><div className="text-[9px] text-[#a0a5af]">{member.role}</div></div></div>)}</aside>
              </div>
            </div>
          </div>
        </section>

        <section id="comunidades" className="mt-24 grid gap-8 border-t border-[#dde1e8] pt-10 sm:grid-cols-3">
          {[{ icon: Waves, title: "Fale do seu jeito", text: "Texto, voz ou vídeo. A conversa acompanha o seu ritmo." }, { icon: Users, title: "Encontre sua turma", text: "Crie espaços com personalidade para as pessoas que importam." }, { icon: Check, title: "Sem ruído", text: "Uma experiência leve, rápida e feita para ficar por perto." }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#dcebe4] text-[#3d7e68]"><Icon size={19} /></span><div><h2 className="text-[15px] font-black">{title}</h2><p className="mt-1 text-[13px] leading-5 text-[#747c8d]">{text}</p></div></div>)}
        </section>
      </main>
    </div>
  );
}