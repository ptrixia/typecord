"use client";

interface AvatarProps {
  avatarUrl?: string | null;
  username?: string;
  globalName?: string | null;
  className?: string;
}

export function resolveFileUrl(urlOrKey?: string | null) {
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
  className = "h-10 w-10",
}: AvatarProps) {
  const displayName = globalName?.trim() || username.trim() || "User";
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
          draggable={false}
          className="h-full w-full select-none object-cover"
        />
      ) : (
        <span className="select-none font-semibold uppercase">
          {firstLetter}
        </span>
      )}
    </div>
  );
}