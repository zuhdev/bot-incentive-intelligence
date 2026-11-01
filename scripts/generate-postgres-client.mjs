import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Prisma's generator requires datasource URLs to validate the schema but does
// not connect to a database. These build-only fallback URLs permit Vercel's
// read-only preview deployment without database credentials.
const buildUrl = "postgresql://build:build@127.0.0.1:5432/build?schema=public";
const env = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL || buildUrl,
  DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || buildUrl,
};

const result = spawnSync(
  process.execPath,
  [resolve(process.cwd(), "node_modules/prisma/build/index.js"), "generate", "--schema", "prisma/postgres/schema.prisma"],
  { cwd: process.cwd(), env, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
