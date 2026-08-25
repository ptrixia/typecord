import { PrismaClient } from "@prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prefer explicit DATABASE_URL, but allow a safe fallback during build/CI where the real DB isn't available.
const connectionString = process.env.DATABASE_URL;

let client: PrismaClient;

if (!connectionString) {
  // Avoid throwing during builds or static analysis when DATABASE_URL isn't set.
  // Create a plain PrismaClient without the Postgres adapter so imports don't fail.
  // Note: runtime DB operations will fail if DATABASE_URL is truly required — keep this behavior explicit.
  client = globalForPrisma.prisma ?? new PrismaClient();
} else {
  const adapter = new PrismaPg({
    connectionString,
  });
  client = globalForPrisma.prisma ?? new PrismaClient({ adapter });
}

export const db = client;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
