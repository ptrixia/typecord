export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export const GatewayErrors = {
  INVALID_TOKEN: new GatewayError(
    "Invalid bot token",
    "INVALID_TOKEN",
    401,
  ),

  BOT_DISABLED: new GatewayError(
    "Bot is disabled",
    "BOT_DISABLED",
    403,
  ),

  BOT_NOT_FOUND: new GatewayError(
    "Bot not found",
    "BOT_NOT_FOUND",
    404,
  ),

  SESSION_NOT_FOUND: new GatewayError(
    "Gateway session not found",
    "SESSION_NOT_FOUND",
    404,
  ),
};