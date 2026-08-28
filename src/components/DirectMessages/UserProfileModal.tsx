"use client";

import { ProfileModal } from "@/components/Profile/ProfileSurface";
import type { DirectUser, RelationshipSummary } from "@/types/direct-messages";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: DirectUser | null;
  currentUserId: string;
  relationship: RelationshipSummary | null;
  onStartDm: (userId: string) => Promise<void> | void;
  onRelationshipsChanged: () => Promise<void> | void;
}

export default function UserProfileModal(props: UserProfileModalProps) {
  return <ProfileModal {...props} />;
}
