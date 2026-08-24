import { redis } from "@/lib/redis";

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const redisKey = `rate-limit:${key}`;

  const count = await redis.incr(redisKey);

  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  const ttl = await redis.ttl(redisKey);

  return {
    success: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    reset: now + Math.max(0, ttl) * 1000,
  };
}