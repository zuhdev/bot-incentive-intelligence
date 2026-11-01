import { NextResponse } from "next/server";
import { ACTIVE_CHAIN } from "@/lib/chains";
import env from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public network metadata for wallet chain switching; contains no secrets. */
export async function GET() {
  return NextResponse.json({
    network: env.BOT_NETWORK,
    chainId: ACTIVE_CHAIN.id,
    name: ACTIVE_CHAIN.name,
    rpcUrl: ACTIVE_CHAIN.rpcUrl,
    explorerUrl: ACTIVE_CHAIN.explorerUrl,
    nativeCurrency: ACTIVE_CHAIN.nativeCurrency,
    incentiveEvidenceNetwork: env.BOT_NETWORK === "mainnet",
  });
}
