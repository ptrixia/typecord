import bcrypt from "bcrypt";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/totp";

function headerValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") {
    return null;
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function loginIp(req: unknown) {
  const headers =
    req && typeof req === "object" && "headers" in req
      ? (req as { headers?: unknown }).headers
      : null;

  const forwarded = headerValue(headers, "x-forwarded-for");
  return (
    headerValue(headers, "cf-connecting-ip") ||
    forwarded?.split(",")[0]?.trim() ||
    headerValue(headers, "x-real-ip") ||
    "unknown"
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        twoFactorCode: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        if (email.length > 255 || password.length > 128) {
          return null;
        }

        const limited = await rateLimit(
          `login:${loginIp(req)}:${email}`,
          10,
          15 * 60,
        );

        if (!limited.success) {
          return null;
        }

        try {
          const user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              username: true,
              globalName: true,
              avatarUrl: true,
              passwordHash: true,
              twoFactorEnabled: true,
              twoFactorSecret: true,
            },
          });

          if (!user?.passwordHash) {
            return null;
          }

          const validPassword = await bcrypt.compare(password, user.passwordHash);
          if (!validPassword) {
            return null;
          }

          const twoFactorCode = String(credentials.twoFactorCode ?? "").trim();
          if (user.twoFactorEnabled && (!user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, twoFactorCode))) {
            throw new Error(twoFactorCode ? "2FA_INVALID" : "2FA_REQUIRED");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.globalName ?? user.username,
            image: user.avatarUrl ?? undefined,
          };
        } catch (error) {
          console.error("[AUTH_AUTHORIZE_ERROR]", error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    // CredentialsProvider só funciona com sessões JWT no NextAuth.
    // O PrismaAdapter continua sendo usado para persistir usuários e contas.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, user, token }) {
      const userId = user?.id ?? (token.id as string | undefined);
      if (session.user && userId) {
        (session.user as typeof session.user & { id: string }).id = userId;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await db.platformLog.create({ data: { level: "security", event: "account.sign_in", userId: user.id } }).catch((error) => console.error("[AUTH_SIGNIN_LOG]", error));
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
