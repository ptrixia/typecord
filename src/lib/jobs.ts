import { redis } from "@/lib/redis";

export type JobName = "notification" | "file-processing" | "message-expiry";
export type JobEnvelope<T> = { id: string; payload: T; createdAt: string; attempts: number };

export async function enqueueJob<T>(name: JobName, payload: T) {
  const job: JobEnvelope<T> = { id: crypto.randomUUID(), payload, createdAt: new Date().toISOString(), attempts: 0 };
  await redis.rpush(`typecord:jobs:${name}`, JSON.stringify(job));
  await redis.sadd("typecord:jobs:known", name);
  return job.id;
}

export async function requeueJob<T>(name: JobName, job: JobEnvelope<T>) {
  const next: JobEnvelope<T> = { ...job, attempts: job.attempts + 1 };
  await redis.rpush(`typecord:jobs:${name}`, JSON.stringify(next));
  return next.id;
}

export async function dequeueJob<T>(name: JobName): Promise<T | null> {
  const raw = await redis.lpop(`typecord:jobs:${name}`);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as { payload: T };
  return parsed.payload;
}

export async function dequeueJobEnvelope<T>(name: JobName): Promise<JobEnvelope<T> | null> {
  const raw = await redis.lpop(`typecord:jobs:${name}`);
  if (!raw) return null;
  return JSON.parse(raw) as JobEnvelope<T>;
}
