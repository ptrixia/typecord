"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthPage() {
  const router = useRouter();

  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

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
  };

  const switchMode = () => {
    setIsRegister((value) => !value);
    resetForm();
  };

  const handleLogin = async () => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("E-mail ou senha incorretos.");
        return false;
      }

      // Redireciona para a rota solicitada do Discord/Typecord
      router.push("/channels/@me");
      router.refresh();

      return true;
    } catch (err) {
      console.error("[LOGIN_ERROR]", err);
      setError("Ocorreu um erro ao tentar entrar.");
      return false;
    }
  };

  const handleRegister = async () => {
    // Validações client-side adicionais por segurança
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return false;
    }

    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return false;
    }

    if (username.length < 2) {
      setError("O nome de usuário precisa ter pelo menos 2 caracteres.");
      return false;
    }

    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        email,
        password,
      }),
    });

    // Leitura segura da resposta (evita crash se a API retornar texto/HTML em vez de JSON)
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text || "Erro desconhecido no servidor." };
    }

    if (!response.ok) {
      setError(data.message || "Não foi possível criar sua conta.");
      return false;
    }

    // Se o registro deu certo, já executa o login automaticamente
    return handleLogin();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      if (isRegister) {
        await handleRegister();
      } else {
        await handleLogin();
      }
    } catch (err) {
      console.error("[AUTH_SUBMIT_ERROR]", err);
      setError("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#E3E5E8] transition-colors duration-300 dark:bg-[#1E1F22]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-[480px] flex-col rounded-[5px] bg-white p-8 shadow-2xl transition-colors duration-300 dark:bg-[#2B2D31]">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold tracking-wide text-[#060607] transition-colors dark:text-[#F2F3F5]">
            {isRegister ? "Crie sua conta" : "Bem-vindo de volta!"}
          </h2>

          <p className="text-[15px] text-[#4E5058] transition-colors dark:text-[#B5BAC1]">
            {isRegister
              ? "Junte-se ao TYPECORD e comece a conversar."
              : "Estamos muito animados em te ver novamente no TYPECORD!"}
          </p>
        </div>

        {/* Form */}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {/* Username */}
          {isRegister && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-[#4E5058] transition-colors dark:text-[#B5BAC1]">
                Nome de usuário <span className="text-red-500">*</span>
              </label>

              <input
                type="text"
                required
                minLength={2}
                maxLength={32}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Digite seu nome de usuário"
                className="w-full rounded-[3px] bg-[#E3E5E8] p-2.5 text-[#060607] outline-none transition-colors placeholder:text-[#6D6F78] focus:ring-1 focus:ring-[#00A8FC] dark:bg-[#1E1F22] dark:text-[#DBDEE1]"
              />
            </div>
          )}

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#4E5058] transition-colors dark:text-[#B5BAC1]">
              E-mail <span className="text-red-500">*</span>
            </label>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full rounded-[3px] bg-[#E3E5E8] p-2.5 text-[#060607] outline-none transition-colors placeholder:text-[#6D6F78] focus:ring-1 focus:ring-[#00A8FC] dark:bg-[#1E1F22] dark:text-[#DBDEE1]"
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-[#4E5058] transition-colors dark:text-[#B5BAC1]">
              Senha <span className="text-red-500">*</span>
            </label>

            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="Digite sua senha"
              className="w-full rounded-[3px] bg-[#E3E5E8] p-2.5 text-[#060607] outline-none transition-colors placeholder:text-[#6D6F78] focus:ring-1 focus:ring-[#00A8FC] dark:bg-[#1E1F22] dark:text-[#DBDEE1]"
            />
          </div>

          {/* Confirm password */}
          {isRegister && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-[#4E5058] transition-colors dark:text-[#B5BAC1]">
                Confirmar senha <span className="text-red-500">*</span>
              </label>

              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Digite sua senha novamente"
                className="w-full rounded-[3px] bg-[#E3E5E8] p-2.5 text-[#060607] outline-none transition-colors placeholder:text-[#6D6F78] focus:ring-1 focus:ring-[#00A8FC] dark:bg-[#1E1F22] dark:text-[#DBDEE1]"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-[3px] bg-red-500/10 px-3 py-2">
              <p className="text-sm font-medium text-red-500">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex h-[44px] w-full items-center justify-center rounded-[3px] bg-[#5865F2] py-2.5 font-medium text-white transition-colors hover:bg-[#4752C4] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isRegister ? (
              "Criar conta"
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        {/* Switch */}
        <div className="mt-6 text-center text-sm">
          <span className="text-[#4E5058] dark:text-[#B5BAC1]">
            {isRegister ? "Já possui uma conta?" : "Ainda não tem uma conta?"}
          </span>{" "}
          <button
            type="button"
            onClick={switchMode}
            disabled={isLoading}
            className="font-medium text-[#00A8FC] hover:underline disabled:opacity-50"
          >
            {isRegister ? "Entrar" : "Registre-se"}
          </button>
        </div>
      </div>
    </div>
  );
}