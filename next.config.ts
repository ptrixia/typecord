import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

function originFrom(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const connectSources = new Set(["'self'", "https:", "wss:"]);

for (const value of [
  process.env.NEXT_PUBLIC_GATEWAY_URL,
  process.env.NEXT_PUBLIC_LIVEKIT_URL,
]) {
  const origin = originFrom(value);

  if (origin) {
    connectSources.add(origin);
  }
}

if (!isProduction) {
  connectSources.add("http:");
  connectSources.add("ws:");
}

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src ${[...connectSources].join(" ")}`,
  "worker-src 'self' blob:",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), display-capture=(self), geolocation=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const staticAssetSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    proxyClientMaxBodySize: "26mb",
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  ...(isProduction
    ? {}
    : {
        allowedDevOrigins: (
          process.env.DEV_ALLOWED_ORIGINS ?? "localhost,127.0.0.1"
        )
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      }),
  async headers() {
    return [
      {
        source: "/_next/static/:path*.css",
        headers: [
          { key: "Content-Type", value: "text/css; charset=utf-8" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/_next/static/:path*.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/_next/static/:path*.mjs",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/_next/static/:path*.map",
        headers: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/_next/static/:path*.woff2",
        headers: [
          { key: "Content-Type", value: "font/woff2" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/_next/static/:path*.woff",
        headers: [
          { key: "Content-Type", value: "font/woff" },
          ...staticAssetSecurityHeaders,
        ],
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
