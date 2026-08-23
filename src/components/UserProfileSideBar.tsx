
import UserProfileContent from "./UserProfileContent";

type Props = {
  user: {
    id: string;
    username?: string | null;
    globalName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export default function UserProfileSideBar({ user }: Props) {
  return <UserProfileContent user={user} />;
}