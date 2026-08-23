import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import InviteClient from "./InviteClient";

type Props = {
  params: Promise<{
    code: string;
  }>;
};

export default async function InvitePage({
  params,
}: Props) {
  const { code } = await params;

  const invite = await db.invite.findUnique({
    where: {
      code,
    },
    include: {
      guild: {
        select: {
          id: true,
          name: true,
          iconUrl: true,
          bannerUrl: true,
        },
      },
    },
  });

  if (!invite) {
    return (
      <InviteClient
        status="not_found"
        code={code}
      />
    );
  }

  if (
    invite.expiresAt &&
    invite.expiresAt.getTime() <= Date.now()
  ) {
    return (
      <InviteClient
        status="expired"
        code={code}
      />
    );
  }

  if (
    invite.maxUses > 0 &&
    invite.uses >= invite.maxUses
  ) {
    return (
      <InviteClient
        status="exhausted"
        code={code}
      />
    );
  }

  const user = await getCurrentUser();

  let alreadyMember = false;

  if (user) {
    const member = await db.member.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: invite.guildId,
        },
      },
      select: {
        id: true,
      },
    });

    alreadyMember = !!member;
  }

  return (
    <InviteClient
      status="valid"
      code={code}
      alreadyMember={alreadyMember}
      guild={{
        id: invite.guild.id,
        name: invite.guild.name,
        iconUrl: invite.guild.iconUrl,
        bannerUrl: invite.guild.bannerUrl,
      }}
    />
  );
}