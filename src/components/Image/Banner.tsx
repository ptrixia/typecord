"use client";

import { getFileUrl } from "@/lib/validations";

interface BannerProps {
  bannerUrl?: string | null;
  className?: string;
  alt?: string;
  onClick?: () => void;
}

export default function Banner({ 
  bannerUrl, 
  className = "h-32 w-full", 
  alt = "Banner",
  onClick 
}: BannerProps) {
  const resolvedBannerUrl = getFileUrl(bannerUrl);

  return (
    <div
      onClick={onClick}
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${className}`}
    >
      {resolvedBannerUrl ? (
        <img
          src={resolvedBannerUrl}
          alt={alt}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />
      )}
    </div>
  );
}
