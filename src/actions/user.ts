"use server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

interface UpdateProfileParams {
  globalName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
}

export type ProfileStatus = "ONLINE" | "IDLE" | "DND" | "OFFLINE";

export type UpdateUserProfileInput = {
  username?: string;
  globalName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  status?: ProfileStatus;
  customStatus?: string | null;
};

const USERNAME_REGEX = /^[a-z0-9._]+$/;
const VALID_STATUSES: ProfileStatus[] = ["ONLINE", "IDLE", "DND", "OFFLINE"];

function cleanNullableText(value: string | null | undefined, maxLength: number) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (normalized.length > maxLength) {
    throw new Error(`O texto pode ter no máximo ${maxLength} caracteres.`);
  }

  return normalized;
}

function cleanMediaReference(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const normalized = value.trim();
  if (!normalized) return null;

  if (normalized.length > 4096) {
    throw new Error("Referência de arquivo inválida.");
  }

  return normalized;
}

export async function updateUserProfile(input: UpdateUserProfileInput) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new Error("Não autorizado.");
  }

  const data: UpdateUserProfileInput = {};

  if (input.username !== undefined) {
    const username = input.username.trim().toLowerCase();

    if (username.length < 2 || username.length > 32) {
      throw new Error("O nome de usuário deve ter entre 2 e 32 caracteres.");
    }

    if (!USERNAME_REGEX.test(username)) {
      throw new Error(
        "O nome de usuário só pode conter letras minúsculas, números, ponto e underline.",
      );
    }

    const existing = await db.user.findFirst({
      where: {
        username,
        id: {
          not: currentUser.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new Error("Este nome de usuário já está em uso.");
    }

    data.username = username;
  }

  if (input.globalName !== undefined) {
    data.globalName = cleanNullableText(input.globalName, 32);
  }

  if (input.bio !== undefined) {
    data.bio = cleanNullableText(input.bio, 190);
  }

  if (input.customStatus !== undefined) {
    data.customStatus = cleanNullableText(input.customStatus, 128);
  }

  if (input.avatarUrl !== undefined) {
    data.avatarUrl = cleanMediaReference(input.avatarUrl);
  }

  if (input.bannerUrl !== undefined) {
    data.bannerUrl = cleanMediaReference(input.bannerUrl);
  }

  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status)) {
      throw new Error("Status inválido.");
    }

    data.status = input.status;
  }

  if (Object.keys(data).length === 0) {
    throw new Error("Nenhuma alteração foi enviada.");
  }

  const updatedUser = await db.user.update({
    where: {
      id: currentUser.id,
    },
    data,
    select: {
      id: true,
      email: true,
      username: true,
      globalName: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      status: true,
      customStatus: true,
    },
  });

  revalidatePath("/");
  revalidatePath("/channels/@me");

  return updatedUser;
}
