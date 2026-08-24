import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

interface LimiterOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export async function limiter(
  request: Request,
  options: LimiterOptions
): Promise<NextResponse | null> {
  const ip = getClientIp(request);

  const result = await rateLimit(
    `${options.key}:${ip}`,
    options.limit,
    options.windowSeconds
  );

  console.log(result)

  if (result.success) {
    return null;
  }

  const retryAfter = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: "You are being rate limited. Please try again later.",
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(
          Math.ceil(result.reset / 1000)
        ),
        "Retry-After": String(retryAfter),
      },
    }
  );
}