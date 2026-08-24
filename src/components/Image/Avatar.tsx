"use client";

interface AvatarProps {
  avatarUrl?: string | null;
  username?: string;
  globalName?: string | null;
  className?: string; 
}

function resolveFileUrl(urlOrKey?: string | null) {
  if (!urlOrKey) return "";
  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://") ||
    urlOrKey.startsWith("blob:") ||
    urlOrKey.startsWith("/")
  ) {
    return urlOrKey;
  }
  return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
}

export default function Avatar({ 
  avatarUrl, 
  username = "User", 
  globalName, 
  className = "h-10 w-10" // Tamanho padrão caso não passe nada
}: AvatarProps) {

  const displayName = globalName || username;
  const firstLetter = displayName.charAt(0).toUpperCase();
  const resolvedAvatarUrl = resolveFileUrl(avatarUrl);

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-300 text-zinc-800 dark:bg-neutral-800 dark:text-zinc-200 ${className}`}
    >
      {resolvedAvatarUrl ? (
        <img
          src={resolvedAvatarUrl}
          alt={displayName}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="select-none font-semibold uppercase">
          {firstLetter}
        </span>
      )}
    </div>
  );
}