export type AppErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: AppErrorCode,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown) {
  if (error instanceof AppError) return error;
  if (error instanceof Error && error.message === "Não autorizado.") {
    return new AppError(error.message, "AUTH_REQUIRED", 401);
  }
  return new AppError("Erro interno do servidor.", "CONFLICT", 500);
}
