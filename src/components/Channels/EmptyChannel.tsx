export default function EmptyChannel() {
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center bg-white dark:bg-[#313338]">
      <div className="flex max-w-md flex-col items-center px-6 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100 dark:bg-[#2b2d31]">
          <span className="text-4xl">📭</span>
        </div>

        <h1 className="text-xl font-bold text-zinc-800 dark:text-white">
          Não há canal aqui
        </h1>

        <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Este canal não existe ou você não tem acesso a ele.
        </p>
      </div>
    </main>
  );
}