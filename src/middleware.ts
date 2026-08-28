import { withAuth } from "next-auth/middleware";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

const BLOCKED_METHODS = new Set([
  "TRACE",
  "TRACK",
  "CONNECT",
]);

const PROTECTED_PAGE_PREFIXES = [
  "/channels",
  "/developers",
];

const PUBLIC_API_EXACT = new Set([
  "/api/login",
  "/api/register",
]);

const PUBLIC_API_PREFIXES = [
  "/api/auth",
];

const SERVICE_API_PATTERNS = [
  /^\/api\/livekit\/webhook\/?$/,
  /^\/api\/gateway\/?$/,
  /^\/api\/gateway\/auth\/?$/,
];

const BOT_API_PATTERNS = [
  /^\/api\/channels\/[^/]+\/messages\/?$/,
];

function matchesPrefix(
  pathname: string,
  prefix: string,
) {
  return (
    pathname === prefix ||
    pathname.startsWith(
      `${prefix}/`,
    )
  );
}

function isProtectedPage(
  pathname: string,
) {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) =>
      matchesPrefix(
        pathname,
        prefix,
      ),
  );
}

function isPublicApi(
  pathname: string,
) {
  if (
    PUBLIC_API_EXACT.has(
      pathname,
    )
  ) {
    return true;
  }

  return PUBLIC_API_PREFIXES.some(
    (prefix) =>
      matchesPrefix(
        pathname,
        prefix,
      ),
  );
}

function isServiceApi(
  pathname: string,
) {
  return SERVICE_API_PATTERNS.some(
    (pattern) =>
      pattern.test(pathname),
  );
}

function isBotApi(
  pathname: string,
) {
  return BOT_API_PATTERNS.some(
    (pattern) =>
      pattern.test(pathname),
  );
}

function hasBotAuthorization(
  request: NextRequest,
) {
  const authorization =
    request.headers.get(
      "authorization",
    );

  if (!authorization) {
    return false;
  }

  return /^Bot\s+\S+$/i.test(
    authorization.trim(),
  );
}

function normalizeOrigin(
  value?: string | null,
) {
  if (!value) {
    return null;
  }

  try {
    const url =
      new URL(value);

    return url.origin;
  } catch {
    return null;
  }
}

function getAllowedOrigins(
  request: NextRequest,
) {
  const origins =
    new Set<string>();

  const requestOrigin =
    normalizeOrigin(
      request.nextUrl.origin,
    );

  if (requestOrigin) {
    origins.add(
      requestOrigin,
    );
  }

  const envOrigins = [
    process.env.NEXTAUTH_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (
    const value of envOrigins
  ) {
    const origin =
      normalizeOrigin(value);

    if (origin) {
      origins.add(origin);
    }
  }

  const forwardedHost =
    request.headers.get(
      "x-forwarded-host",
    );

  const forwardedProto =
    request.headers.get(
      "x-forwarded-proto",
    );

  if (
    forwardedHost &&
    forwardedProto
  ) {
    const forwardedOrigin =
      normalizeOrigin(
        `${forwardedProto}://${forwardedHost}`,
      );

    if (forwardedOrigin) {
      origins.add(
        forwardedOrigin,
      );
    }
  }

  return origins;
}

function isUnsafeCrossSiteRequest(
  request: NextRequest,
) {
  const method =
    request.method.toUpperCase();

  if (
    SAFE_METHODS.has(method)
  ) {
    return false;
  }

  const fetchSite =
    request.headers
      .get("sec-fetch-site")
      ?.toLowerCase();

  if (
    fetchSite ===
    "cross-site"
  ) {
    return true;
  }

  const origin =
    request.headers.get(
      "origin",
    );

  if (!origin) {
    return false;
  }

  const normalizedOrigin =
    normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return true;
  }

  const allowedOrigins =
    getAllowedOrigins(
      request,
    );

  return !allowedOrigins.has(
    normalizedOrigin,
  );
}

function applySecurityHeaders(
  response: NextResponse,
  request: NextRequest,
  requestId: string,
) {
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );

  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "X-Frame-Options",
    "SAMEORIGIN",
  );

  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );

  response.headers.set(
    "Permissions-Policy",
    [
      "camera=(self)",
      "microphone=(self)",
      "display-capture=(self)",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "browsing-topics=()",
    ].join(", "),
  );


  response.headers.set(
    "Content-Security-Policy",
    [
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  response.headers.set(
    "X-Request-Id",
    requestId,
  );

  const protocol =
    request.headers.get(
      "x-forwarded-proto",
    ) ??
    request.nextUrl.protocol.replace(
      ":",
      "",
    );

  if (
    process.env.NODE_ENV ===
      "production" &&
    protocol === "https"
  ) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000",
    );
  }

  return response;
}

function jsonError(
  request: NextRequest,
  requestId: string,
  status: number,
  message: string,
) {
  const response =
    NextResponse.json(
      {
        success: false,
        message,
        requestId,
      },
      {
        status,
      },
    );

  response.headers.set(
    "Cache-Control",
    "no-store",
  );

  return applySecurityHeaders(
    response,
    request,
    requestId,
  );
}

export default withAuth(
  function secureProxy(
    request,
  ) {
    const pathname =
      request.nextUrl.pathname;

    const method =
      request.method.toUpperCase();

    const requestId =
      crypto.randomUUID();

    if (
      BLOCKED_METHODS.has(
        method,
      )
    ) {
      return jsonError(
        request,
        requestId,
        405,
        "Método HTTP não permitido.",
      );
    }

    const isApi =
      pathname === "/api" ||
      pathname.startsWith(
        "/api/",
      );

    const publicApi =
      isPublicApi(pathname);

    const serviceApi =
      isServiceApi(pathname);

    const botApi =
      isBotApi(pathname);
    if (
      isApi &&
      !publicApi &&
      !serviceApi &&
      isUnsafeCrossSiteRequest(
        request,
      )
    ) {
      console.warn(
        "[SECURITY_CROSS_SITE_BLOCKED]",
        {
          requestId,
          method,
          pathname,
          origin:
            request.headers.get(
              "origin",
            ),
          fetchSite:
            request.headers.get(
              "sec-fetch-site",
            ),
        },
      );

      return jsonError(
        request,
        requestId,
        403,
        "Origem da requisição não permitida.",
      );
    }

    const token =
      request.nextauth.token;

    const authenticated =
      Boolean(token?.sub);
    if (
      isProtectedPage(
        pathname,
      ) &&
      !authenticated
    ) {
      const loginUrl =
        new URL(
          "/login",
          request.url,
        );

      const callbackUrl =
        `${pathname}${request.nextUrl.search}`;

      loginUrl.searchParams.set(
        "callbackUrl",
        callbackUrl,
      );

      const response =
        NextResponse.redirect(
          loginUrl,
          307,
        );

      response.headers.set(
        "Cache-Control",
        "no-store",
      );

      return applySecurityHeaders(
        response,
        request,
        requestId,
      );
    }
    if (
      isApi &&
      !publicApi &&
      !serviceApi
    ) {

      const botAuthorizedRequest =
        botApi &&
        hasBotAuthorization(
          request,
        );

      if (
        !authenticated &&
        !botAuthorizedRequest
      ) {
        return jsonError(
          request,
          requestId,
          401,
          "Autenticação necessária.",
        );
      }
    }

    const requestHeaders =
      new Headers(
        request.headers,
      );

    requestHeaders.set(
      "x-request-id",
      requestId,
    );

    const response =
      NextResponse.next({
        request: {
          headers:
            requestHeaders,
        },
      });

    return applySecurityHeaders(
      response,
      request,
      requestId,
    );
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: () =>
        true,
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)",
  ],
};
