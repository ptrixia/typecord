import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL;

function initPrismaClient(): PrismaClient {
  if (!connectionString) {
    console.warn(
      "[PRISMA_WARN] DATABASE_URL não foi definida. A conexão com o banco falhará em tempo de execução."
    );
  }

  const pool = new Pool({ connectionString: connectionString || "" });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? initPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}