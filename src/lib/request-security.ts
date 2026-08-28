import { NextResponse } from "next/server";

import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";

function normalizeOrigin(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(
  value: string | null,
): string | null {
  if (!value) {
    return null;
  }

  return (
    value
      .split(",")[0]
      ?.trim() || null
  );
}

function getConfiguredOrigins(): Set<string> {
  const origins =
    new Set<string>();

  const values = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
  ];

  for (const value of values) {
    const origin =
      normalizeOrigin(value);

    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
}

function getForwardedOrigin(
  request: Request,
): string | null {
  const forwardedHost =
    firstHeaderValue(
      request.headers.get(
        "x-forwarded-host",
      ),
    );

  const forwardedProto =
    firstHeaderValue(
      request.headers.get(
        "x-forwarded-proto",
      ),
    );

  if (
    !forwardedHost ||
    !forwardedProto
  ) {
    return null;
  }

  return normalizeOrigin(
    `${forwardedProto}://${forwardedHost}`,
  );
}

function getHostOrigin(
  request: Request,
): string | null {
  const host =
    firstHeaderValue(
      request.headers.get("host"),
    );

  if (!host) {
    return null;
  }

  const forwardedProto =
    firstHeaderValue(
      request.headers.get(
        "x-forwarded-proto",
      ),
    );

  let protocol =
    forwardedProto;

  if (!protocol) {
    try {
      protocol =
        new URL(
          request.url,
        ).protocol.replace(
          ":",
          "",
        );
    } catch {
      protocol = null;
    }
  }

  if (!protocol) {
    return null;
  }

  return normalizeOrigin(
    `${protocol}://${host}`,
  );
}

function getRequestUrlOrigin(
  request: Request,
): string | null {
  try {
    return new URL(
      request.url,
    ).origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(
  request: Request,
): Set<string> {
  const origins =
    getConfiguredOrigins();

  const forwardedOrigin =
    getForwardedOrigin(
      request,
    );

  if (forwardedOrigin) {
    origins.add(
      forwardedOrigin,
    );
  }

  const hostOrigin =
    getHostOrigin(
      request,
    );

  if (hostOrigin) {
    origins.add(hostOrigin);
  }

  if (
    process.env.NODE_ENV !==
    "production"
  ) {
    const requestOrigin =
      getRequestUrlOrigin(
        request,
      );

    if (requestOrigin) {
      origins.add(
        requestOrigin,
      );
    }

    origins.add(
      "http://localhost:3000",
    );

    origins.add(
      "http://127.0.0.1:3000",
    );
  }

  return origins;
}

export function isSameOriginRequest(
  request: Request,
): boolean {
  const fetchSite =
    request.headers
      .get("sec-fetch-site")
      ?.trim()
      .toLowerCase();

  /*
   * O navegador já confirmou que
   * origem e destino são exatamente
   * a mesma origem.
   */
  if (
    fetchSite ===
    "same-origin"
  ) {
    return true;
  }

  /*
   * O navegador confirmou explicitamente
   * que a requisição veio de outro site.
   */
  if (
    fetchSite ===
    "cross-site"
  ) {
    return false;
  }

  const originHeader =
    request.headers.get(
      "origin",
    );

  /*
   * Requests server-to-server,
   * webhooks, bots etc. podem não
   * possuir Origin.
   *
   * A autenticação/autorização da
   * própria rota continua obrigatória.
   */
  if (!originHeader) {
    return true;
  }

  const requestOrigin =
    normalizeOrigin(
      originHeader,
    );

  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins =
    getAllowedOrigins(
      request,
    );

  return allowedOrigins.has(
    requestOrigin,
  );
}

export function sameOriginError() {
  return NextResponse.json(
    {
      success: false,
      message:
        "Origem da requisição não permitida.",
    },
    {
      status: 403,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function enforceRateLimit(
  request: Request,
  namespace: string,
  limit: number,
  windowSeconds: number,
  identity?: string,
) {
  const ip =
    getClientIp(request);

  const normalizedIdentity =
    identity?.trim();

  const key =
    `${namespace}:${
      normalizedIdentity ||
      ip
    }`;

  const result =
    await rateLimit(
      key,
      limit,
      windowSeconds,
    );

  if (result.success) {
    return null;
  }

  const retryAfter =
    Math.max(
      1,
      Math.ceil(
        (result.reset -
          Date.now()) /
          1000,
      ),
    );

  return NextResponse.json(
    {
      success: false,
      message:
        "Muitas requisições. Tente novamente em instantes.",
    },
    {
      status: 429,

      headers: {
        "Cache-Control":
          "no-store",

        "Retry-After":
          String(
            retryAfter,
          ),

        "X-RateLimit-Limit":
          String(
            result.limit,
          ),

        "X-RateLimit-Remaining":
          String(
            result.remaining,
          ),

        "X-RateLimit-Reset":
          String(
            result.reset,
          ),
      },
    },
  );
}