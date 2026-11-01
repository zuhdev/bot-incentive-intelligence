import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const sourcePath = resolve(root, "prisma/schema.prisma");
const targetPath = resolve(root, "prisma/postgres/schema.prisma");
const source = await readFile(sourcePath, "utf8");
const target = source.replace(/(datasource\s+db\s*\{[\s\S]*?provider\s*=\s*)"sqlite"/, '$1"postgresql"');

if (target === source || !/provider\s*=\s*"postgresql"/.test(target)) {
  throw new Error("Could not produce the PostgreSQL Prisma schema from prisma/schema.prisma");
}

await mkdir(dirname(targetPath), { recursive: true });
await writeFile(targetPath, target, "utf8");
console.log("Generated prisma/postgres/schema.prisma (source: prisma/schema.prisma)");
