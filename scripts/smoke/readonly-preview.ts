/** Smoke test database-free production preview behavior and live provider status for the selected network. */
import env from "../../src/lib/env";
import { databaseAvailable } from "../../src/lib/db";
import { requireSession, getSessionUser } from "../../src/lib/auth";
import { getOverview } from "../../src/lib/overview";
import { checkAllProviders } from "../../src/lib/providers/health";

async function main() {
  if (env.NODE_ENV !== "production" || databaseAvailable) {
    throw new Error("Set NODE_ENV=production, set BOT_NETWORK explicitly (mainnet or testnet), and omit DATABASE_URL/DIRECT_DATABASE_URL.");
  }
  const [overview, user, providers] = await Promise.all([
    getOverview(),
    getSessionUser(),
    checkAllProviders(),
  ]);
  let signInStatus: number | null = null;
  try {
    await requireSession();
  } catch (error) {
    signInStatus = (error as { status?: number }).status ?? null;
  }

  if (overview.databaseAvailable !== false || user !== null || signInStatus !== 503) {
    throw new Error("Database-free preview did not return its expected read-only/auth-disabled state.");
  }
  if (!providers.filter((provider) => provider.supported).every((provider) => provider.ok)) {
    throw new Error(`One or more supported live ${env.BOT_NETWORK} providers are unhealthy.`);
  }

  console.log(JSON.stringify({
    mode: "read-only preview",
    network: env.BOT_NETWORK,
    chainId: env.BOT_CHAIN_ID,
    appUrl: env.NEXT_PUBLIC_APP_URL,
    databaseConfigured: databaseAvailable,
    signInStatus,
    providers: providers.map(({ name, ok, supported }) => ({ name, ok, supported })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
