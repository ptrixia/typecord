import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcrypt";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: {
          label: "E-mail",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log("[AUTH] E-mail ou senha ausentes.");
          return null;
        }

        const email = String(credentials.email)
          .trim()
          .toLowerCase();

        const password = String(credentials.password);

        console.log(`[AUTH] Procurando usuário: ${email}`);

        try {
          const user = await db.user.findUnique({
            where: {
              email,
            },
          });

          if (!user) {
            console.log(
              `[AUTH] Usuário não encontrado para o e-mail: ${email}`
            );

            return null;
          }

          console.log(
            `[AUTH] Usuário encontrado: ${user.id} (@${user.username})`
          );

          if (!user.passwordHash) {
            console.log(
              `[AUTH] Usuário ${email} não possui passwordHash.`
            );

            return null;
          }

          const validPassword = await bcrypt.compare(
            password,
            user.passwordHash
          );

          if (!validPassword) {
            console.log(
              `[AUTH] Senha incorreta para: ${email}`
            );

            return null;
          }

          console.log(
            `[AUTH] Login bem-sucedido para: ${email}`
          );

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
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as typeof session.user & { id: string }).id =
          token.id as string;
      }

      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};