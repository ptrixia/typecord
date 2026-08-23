"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Loader2,
  Lock,
  Mail,
  User,
} from "lucide-react";

export default function AuthPage() {
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const resetForm = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setSuccessMessage("");
  };

  const changeMode = (register: boolean) => {
    if (isLoading) return;

    setIsRegister(register);
    resetForm();
  };


  const handleLogin = async (
    loginEmail: string,
    loginPassword: string
  ): Promise<boolean> => {
    const normalizedEmail = loginEmail.toLowerCase().trim();

    if (!normalizedEmail || !loginPassword) {
      setError("Informe seu e-mail e sua senha.");
      return false;
    }

    try {
      console.log(
        "[AUTH_CLIENT] Tentando login para:",
        normalizedEmail
      );

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password: loginPassword,
        redirect: false,
      });

      console.log("[AUTH_CLIENT] Resultado do signIn:", result);

      if (!result) {
        console.error(
          "[AUTH_CLIENT] NextAuth não retornou resultado."
        );

        setError("Não foi possível realizar o login.");
        return false;
      }

      if (result.error) {
        console.error(
          "[AUTH_CLIENT] Erro no login:",
          result.error
        );

        setError("E-mail ou senha incorretos.");
        return false;
      }

      if (result.ok) {
        console.log(
          "[AUTH_CLIENT] Login realizado com sucesso."
        );

        setSuccessMessage("Login realizado com sucesso!");

        router.push("/channels/@me");
        router.refresh();

        return true;
      }

      setError("Não foi possível realizar o login.");
      return false;
    } catch (error) {
      console.error("[LOGIN_ERROR]", error);

      setError(
        "Ocorreu um erro ao tentar entrar. Tente novamente."
      );

      return false;
    }
  };

  const handleRegister = async (): Promise<boolean> => {
    const normalizedUsername = username.trim();
    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedUsername.length < 2) {
      setError(
        "O nome de usuário precisa ter pelo menos 2 caracteres."
      );
      return false;
    }

    if (normalizedUsername.length > 32) {
      setError(
        "O nome de usuário pode ter no máximo 32 caracteres."
      );
      return false;
    }

    if (password.length < 6) {
      setError(
        "A senha precisa ter pelo menos 6 caracteres."
      );
      return false;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return false;
    }

    if (!normalizedEmail) {
      setError("Informe um e-mail válido.");
      return false;
    }

    try {
      console.log(
        "[AUTH_CLIENT] Iniciando registro:",
        normalizedEmail
      );

      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: normalizedUsername,
          email: normalizedEmail,
          password,
        }),
      });

      console.log(
        "[AUTH_CLIENT] Status do registro:",
        response.status
      );

      let data: {
        message?: string;
        user?: {
          id?: string;
          username?: string;
          email?: string;
        };
      } = {};

      try {
        data = await response.json();
      } catch {
        console.error(
          "[AUTH_CLIENT] Resposta do registro não é JSON."
        );
      }

      console.log(
        "[AUTH_CLIENT] Resposta do registro:",
        data
      );


      if (response.status !== 201) {
        console.error(
          "[AUTH_CLIENT] Registro não foi concluído. Status:",
          response.status,
          data
        );

        setError(
          data.message ||
            "Não foi possível criar sua conta."
        );

        return false;
      }

      if (!data.user) {
        console.warn(
          "[AUTH_CLIENT] Usuário criado, mas resposta não contém user."
        );
      }

      console.log(
        "[AUTH_CLIENT] Conta criada com sucesso:",
        data.user
      );

      setSuccessMessage(
        "Conta criada com sucesso! Entrando..."
      );


      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );


      const loggedIn = await handleLogin(
        normalizedEmail,
        password
      );

      if (!loggedIn) {
 
        setError(
          "Sua conta foi criada, mas não foi possível entrar automaticamente. Tente fazer login novamente."
        );

        setSuccessMessage("");
        return false;
      }

      return true;
    } catch (error) {
      console.error(
        "[REGISTER_ERROR]",
        error
      );

      setError(
        "Ocorreu um erro ao registrar a conta."
      );

      return false;
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      if (isRegister) {
        await handleRegister();
      } else {
        await handleLogin(email, password);
      }
    } catch (error) {
      console.error(
        "[AUTH_SUBMIT_ERROR]",
        error
      );

      setError(
        "Ocorreu um erro inesperado. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-stone-100 px-4 transition-colors duration-300 dark:bg-[#111214]">
      {/* Theme */}
      <div className="absolute right-6 top-6 z-20">
        <ThemeToggle />
      </div>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#313338_1px,transparent_1px)] opacity-20 [background-size:16px_16px]" />

      {/* Card */}
      <div className="relative z-10 flex w-full max-w-[440px] flex-col rounded-2xl border border-stone-200 bg-white p-8 shadow-2xl transition-all duration-300 dark:border-zinc-800 dark:bg-[#1e1f22]">
        {/* Header */}
        <div className="mb-6 text-center">
          

          <h2 className="text-2xl font-bold tracking-tight text-stone-900 transition-colors dark:text-white">
            {isRegister
              ? "Crie sua conta"
              : "Faça login"}
          </h2>

          <p className="mt-1 text-sm text-stone-500 transition-colors dark:text-zinc-400">
            {isRegister
              ? "Junte-se ao Typecord e conecte-se com seus amigos."
              : "Estamos felizes em ver você aqui!"}
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-stone-100 p-1 dark:bg-black/40">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => changeMode(false)}
            className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              !isRegister
                ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Entrar
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => changeMode(true)}
            className={`flex-1 rounded-md py-2 text-xs font-bold uppercase tracking-wider transition-all ${
              isRegister
                ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            Registrar-se
          </button>
        </div>

        {/* Form */}
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
        >
          {/* Username */}
          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-zinc-400">
                Nome de usuário{" "}
                <span className="text-red-500">*</span>
              </label>

              <div className="relative flex items-center">
                <User className="absolute left-3 h-4 w-4 text-stone-400 dark:text-zinc-500" />

                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={32}
                  value={username}
                  onChange={(event) =>
                    setUsername(event.target.value)
                  }
                  autoComplete="username"
                  placeholder="Seu nome de usuário"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-900 outline-none transition-all focus:border-indigo-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/40 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-zinc-400">
              E-mail{" "}
              <span className="text-red-500">*</span>
            </label>

            <div className="relative flex items-center">
              <Mail className="absolute left-3 h-4 w-4 text-stone-400 dark:text-zinc-500" />

              <input
                type="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                placeholder="seu@email.com"
                disabled={isLoading}
                className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-900 outline-none transition-all focus:border-indigo-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/40 dark:text-white dark:focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-zinc-400">
              Senha{" "}
              <span className="text-red-500">*</span>
            </label>

            <div className="relative flex items-center">
              <Lock className="absolute left-3 h-4 w-4 text-stone-400 dark:text-zinc-500" />

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete={
                  isRegister
                    ? "new-password"
                    : "current-password"
                }
                placeholder="Sua senha secreta"
                disabled={isLoading}
                className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-900 outline-none transition-all focus:border-indigo-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/40 dark:text-white dark:focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Confirm Password */}
          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-zinc-400">
                Confirmar senha{" "}
                <span className="text-red-500">*</span>
              </label>

              <div className="relative flex items-center">
                <Lock className="absolute left-3 h-4 w-4 text-stone-400 dark:text-zinc-500" />

                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  placeholder="Confirme sua senha"
                  disabled={isLoading}
                  className="w-full rounded-lg border border-stone-300 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-900 outline-none transition-all focus:border-indigo-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-black/40 dark:text-white dark:focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5">
              <p className="text-xs font-medium text-red-500">
                {error}
              </p>
            </div>
          )}

          {/* Success */}
          {successMessage && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-xs font-medium text-emerald-500">
                {successMessage}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRegister ? (
              "Criar Conta e Entrar"
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Bottom switch */}
        <div className="mt-6 text-center text-sm">
          <span className="text-stone-500 dark:text-zinc-400">
            {isRegister
              ? "Já possui uma conta?"
              : "Ainda não tem uma conta?"}
          </span>{" "}

          <button
            type="button"
            onClick={() =>
              changeMode(!isRegister)
            }
            disabled={isLoading}
            className="font-semibold text-indigo-600 transition-colors hover:underline disabled:opacity-50 dark:text-indigo-400"
          >
            {isRegister
              ? "Entrar"
              : "Registre-se agora"}
          </button>
        </div>
      </div>
    </div>
  );
}