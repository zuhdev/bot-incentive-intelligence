/**
 * Generate one mainnet deployer EVM account and store its private key in an
 * ignored, current-user-only local file. The key is never printed.
 * Run once: npm run wallet:mainnet:create
 *
 * Security: this creates a hot key. Use a dedicated account funded with only
 * the BOT required for the deployment, and keep the key file off backups and
 * out of source control. For higher-value operations, import a hardware-backed
 * account into .secrets/bot-mainnet-deployer.json manually instead.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import env from "../src/lib/env";

if (env.NODE_ENV === "production") {
  throw new Error("Refusing to create a private key from a production runtime. Run this locally.");
}

const secretsDir = resolve(process.cwd(), ".secrets");
const secretFile = resolve(secretsDir, "bot-mainnet-deployer.json");
if (existsSync(secretFile)) {
  throw new Error(`Refusing to overwrite existing wallet file: ${secretFile}`);
}

mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
if (process.platform === "win32") {
  const account = execFileSync("whoami", [], { encoding: "utf8" }).trim();
  // Remove inherited access and grant this Windows account full control.
  execFileSync("icacls", [secretsDir, "/inheritance:r", "/grant:r", `${account}:(OI)(CI)F`], { stdio: "ignore" });
} else {
  chmodSync(secretsDir, 0o700);
}

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);
const record = {
  network: "BOT Chain",
  chainId: env.BOT_MAINNET_CHAIN_ID,
  address: account.address,
  privateKey,
  createdAt: new Date().toISOString(),
  note: "Mainnet deployer account. Dedicated, minimally funded. This file is ignored by Git and never committed.",
};

writeFileSync(secretFile, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
if (process.platform !== "win32") chmodSync(secretFile, 0o600);

console.log(`BOT Chain mainnet deployer address: ${account.address}`);
console.log(`Private key saved locally (not printed): ${secretFile}`);
console.log("Fund this address with only the BOT needed for the deployment, then run npm run wallet:mainnet:balance.");
