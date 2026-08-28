"use client";

import { ProfileSurface, type ProfileUser } from "./Profile/ProfileSurface";

export default function UserMiniProfile({
  user,
  fallbackName = "Usuário",
  onMessage,
}: {
  user?: ProfileUser | null;
  fallbackName?: string;
  onMessage?: () => void;
}) {
  return (
    <ProfileSurface
      user={user}
      fallbackName={fallbackName}
      onStartDm={onMessage ? () => onMessage() : undefined}
      variant="preview"
    />
  );
}
