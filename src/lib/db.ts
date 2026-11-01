import { PrismaClient } from "@prisma/client";
import env from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const databaseAvailable = env.DATABASE_ENABLED;

export const prisma =
  databaseAvailable
    ? globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : new Proxy({}, {
        get(_target, property) {
          if (property === "$disconnect") return async () => undefined;
          throw new DatabaseUnavailableError();
        },
      }) as PrismaClient;

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database not configured. Add DATABASE_URL to enable persistent features.");
    this.name = "DatabaseUnavailableError";
  }
}

if (databaseAvailable && process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
