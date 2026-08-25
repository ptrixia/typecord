import type { Metadata } from "next";
import { cache } from "react";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

import InviteClient from "./InviteClient";

type Props = {
  params: Promise<{
    code: string;
  }>;

  searchParams: Promise<{
    autoJoin?: string | string[];
  }>;
};

const getInvite = cache(async (code: string) => {
  return db.invite.findUnique({
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
});

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const { code } = await params;

  const invite = await getInvite(code);

  if (!invite) {
    return {
      title: "Convite inválido",
      description:
        "Esse convite do Typecord não existe ou não está mais disponível.",

      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const guild = invite.guild;

  const title = `Você foi convidado para ${guild.name}`;

  const description =
    `Entre em ${guild.name} no Typecord. Aceite o convite e participe da comunidade.`;

  const image =
    guild.bannerUrl ||
    guild.iconUrl ||
    "/og-image.png";

  return {
    title,

    description,

    robots: {
      index: false,
      follow: false,
    },

    openGraph: {
      type: "website",
      title,
      description,

      images: [
        {
          url: image,
          alt: guild.name,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function InvitePage({
  params,
  searchParams,
}: Props) {
  const { code } = await params;
  const query = await searchParams;

  const autoJoin =
    query.autoJoin === "1";

  const invite = await getInvite(code);

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
    const member =
      await db.member.findUnique({
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

    alreadyMember = Boolean(member);
  }

  return (
    <InviteClient
      status="valid"
      code={code}
      authenticated={Boolean(user)}
      alreadyMember={alreadyMember}
      autoJoin={autoJoin}
      guild={{
        id: invite.guild.id,
        name: invite.guild.name,
        iconUrl: invite.guild.iconUrl,
        bannerUrl:
          invite.guild.bannerUrl,
      }}
    />
  );
}