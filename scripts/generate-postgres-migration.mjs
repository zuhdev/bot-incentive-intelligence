import { spawnSync } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const schema = resolve(root, "prisma/postgres/schema.prisma");
const migrationsRoot = resolve(root, "prisma/postgres/migrations");
const initialDir = resolve(migrationsRoot, "20261101000000_initial");
let hasInitial = false;
try {
  await access(resolve(initialDir, "migration.sql"));
  hasInitial = true;
} catch {}

let migrationDir = initialDir;
let diffArgs;
if (!hasInitial) {
  diffArgs = ["--from-empty", "--to-schema-datamodel", schema, "--script"];
} else {
  if (!process.env.SHADOW_DATABASE_URL) {
    throw new Error("Set SHADOW_DATABASE_URL to a disposable PostgreSQL database to generate a migration from existing migration history.");
  }
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  migrationDir = resolve(migrationsRoot, `${timestamp}_schema_change`);
  diffArgs = [
    "--from-migrations", migrationsRoot,
    "--to-schema-datamodel", schema,
    "--shadow-database-url", process.env.SHADOW_DATABASE_URL,
    "--script",
  ];
}
await mkdir(migrationDir, { recursive: true });

const result = spawnSync(
  process.execPath,
  [resolve(root, "node_modules/prisma/build/index.js"), "migrate", "diff", ...diffArgs],
  { cwd: root, encoding: "utf8" },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "Prisma migration diff failed\n");
  process.exit(result.status ?? 1);
}

await writeFile(resolve(migrationDir, "migration.sql"), result.stdout, "utf8");
await writeFile(resolve(migrationsRoot, "migration_lock.toml"), 'provider = "postgresql"\n', "utf8");
console.log(`Generated PostgreSQL migration: ${migrationDir}`);
