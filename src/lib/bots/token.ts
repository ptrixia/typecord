import crypto from "node:crypto";

export function generateBotToken(): string {
  return `tc_bot_${crypto.randomBytes(48).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export function extractBotToken(
  request: Request,
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  if (!authorization.startsWith("Bot ")) {
    return null;
  }

  const token = authorization
    .slice(4)
    .trim();

  if (!token) {
    return null;
  }

  return token;
}