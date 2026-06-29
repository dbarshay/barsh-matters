import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const databaseUrl =
  process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("No Postgres database URL found.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  // Enforce TLS with certificate verification (matches the login pool). If the URL already
  // carries sslmode=require, let pg honor it; otherwise require verified TLS explicitly.
  ssl: databaseUrl.includes("sslmode=require") ? undefined : { rejectUnauthorized: true },
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
