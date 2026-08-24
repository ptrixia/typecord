"use client";

interface BannerProps {
  bannerUrl?: string | null;
  className?: string;
  onClick?: () => void;
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

export default function Banner({ 
  bannerUrl, 
  className = "h-32 w-full", 
  onClick 
}: BannerProps) {
  const resolvedBannerUrl = resolveFileUrl(bannerUrl);

  return (
    <div
      onClick={onClick}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${className}`}
    >
      {resolvedBannerUrl ? (
        <img
          src={resolvedBannerUrl}
          alt="Guild Banner"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />
      )}
    </div>
  );
}