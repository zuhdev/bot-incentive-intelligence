import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  BOT_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet"),
  BOT_MAINNET_RPC_URL: z.string().url().default("https://rpc.botchain.ai"),
  BOT_TESTNET_RPC_URL: z.string().url().default("https://rpc.bohr.life"),
  BOT_MAINNET_CHAIN_ID: z.coerce.number().int().positive().default(677),
  BOT_TESTNET_CHAIN_ID: z.coerce.number().int().positive().default(968),
  BOT_MAINNET_SCAN_API_URL: z.string().url().default("https://scan.botchain.ai/api"),
  BOT_TESTNET_SCAN_API_URL: z.string().url().default("https://scan.bohr.life/api"),
  BOT_MAINNET_EXPLORER_URL: z.string().url().default("https://scan.botchain.ai"),
  BOT_TESTNET_EXPLORER_URL: z.string().url().default("https://scan.bohr.life"),
  BDEX_API_URL: z.string().url().default("https://dex-wallet.botchain.ai"),
  BDEX_API_ENABLED: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  DEFILLAMA_API_URL: z.string().url().default("https://api.llama.fi"),
  DEFAULT_BOT_PROTOCOL_SLUG: z.string().default("bdex-v3"),
  INGEST_LOG_CHUNK: z.coerce.number().int().positive().default(20_000),
  INGEST_BACKFILL_MAX_BLOCKS: z.coerce.number().int().positive().default(500_000),
  AUTH_SECRET: z.string().min(32).optional(),
  REDIS_URL: z.string().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  if (process.env.NODE_ENV === "production") {
    throw new Error(`[env] Invalid production configuration: ${detail}`);
  }
  console.warn(`[env] Invalid configuration: ${detail}`);
}

const base = parsed.success ? parsed.data : schema.parse({});
if (process.env.NODE_ENV === "production") {
  if (!base.AUTH_SECRET) throw new Error("[env] AUTH_SECRET must be set to a random value of at least 32 characters in production.");
  if (base.BOT_NETWORK === "testnet" && !/^postgres(?:ql)?:\/\//i.test(base.DATABASE_URL)) {
    throw new Error("[env] Production deployments require PostgreSQL; SQLite is supported for local development only.");
  }
  if (base.BOT_NETWORK === "testnet" && !base.DIRECT_DATABASE_URL) {
    throw new Error("[env] DIRECT_DATABASE_URL is required for PostgreSQL migrations and client generation in testnet production.");
  }
}
const testnet = base.BOT_NETWORK === "testnet";

/** Network-selected values: all runtime providers must use these aliases. */
const env = {
  ...base,
  DIRECT_DATABASE_URL: base.DIRECT_DATABASE_URL ?? base.DATABASE_URL,
  AUTH_SECRET: base.AUTH_SECRET ?? "dev-only-secret-change-me-0123456789abcdef",
  BOT_CHAIN_ID: testnet ? base.BOT_TESTNET_CHAIN_ID : base.BOT_MAINNET_CHAIN_ID,
  BOT_RPC_URL: testnet ? base.BOT_TESTNET_RPC_URL : base.BOT_MAINNET_RPC_URL,
  BOTSCAN_API_URL: testnet ? base.BOT_TESTNET_SCAN_API_URL : base.BOT_MAINNET_SCAN_API_URL,
  BOT_EXPLORER_URL: testnet ? base.BOT_TESTNET_EXPLORER_URL : base.BOT_MAINNET_EXPLORER_URL,
  // BDEX's verified public data and DeFiLlama's BOT Chain TVL are mainnet-only.
  BDEX_ENABLED: base.BDEX_API_ENABLED && !testnet,
  DEFILLAMA_BOT_TVL_ENABLED: !testnet,
} as const;

export default env;

export const IS_DEV = env.NODE_ENV === "development";
