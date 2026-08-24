"use client";

import Avatar from "../Image/Avatar";
import type { UserStatus } from "@/types/direct-messages";

interface DirectAvatarProps {
  name: string;
  avatarUrl?: string | null;
  status?: UserStatus;
  size?: "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  className?: string;
}

const sizeClasses: Record<
  NonNullable<DirectAvatarProps["size"]>,
  string
> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const statusSizeClasses: Record<
  NonNullable<DirectAvatarProps["size"]>,
  string
> = {
  sm: "h-3 w-3 border-2",
  md: "h-3.5 w-3.5 border-[3px]",
  lg: "h-4 w-4 border-[3px]",
  xl: "h-5 w-5 border-[4px]",
};

const statusClasses: Record<UserStatus, string> = {
  ONLINE: "bg-emerald-500",
  IDLE: "bg-amber-400",
  DND: "bg-rose-500",
  OFFLINE: "bg-zinc-500",
};

export default function DirectAvatar({
  name,
  avatarUrl,
  status = "OFFLINE",
  size = "md",
  showStatus = false,
  className = "",
}: DirectAvatarProps) {
  const normalizedName = name.trim() || "?";

  const initials =
    normalizedName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "?";

  return (
    <div
      className={`relative shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-indigo-600 font-bold text-white">
        {avatarUrl ? (
          <Avatar
            avatarUrl={avatarUrl}
            username={normalizedName}
            className="h-full w-full"
          />
        ) : (
          <span className="select-none">
            {initials}
          </span>
        )}
      </div>

      {showStatus && (
        <span
          title={status}
          className={`absolute bottom-0 right-0 rounded-full border-zinc-50 dark:border-zinc-950 ${statusSizeClasses[size]} ${statusClasses[status]}`}
        />
      )}
    </div>
  );
}