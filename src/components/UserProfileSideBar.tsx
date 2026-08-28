"use client";

import UserProfileContent from "./UserProfileContent";

export type UserProfileData = {
  id: string;
  email?: string | null;
  username?: string | null;
  globalName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  status?: "ONLINE" | "IDLE" | "DND" | "OFFLINE" | null;
  customStatus?: string | null;
};

interface UserProfileSideBarProps {
  user: UserProfileData | null;
}

export default function UserProfileSideBar({ user }: UserProfileSideBarProps) {
  return <UserProfileContent user={user} />;
}