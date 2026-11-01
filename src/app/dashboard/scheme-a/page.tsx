import { SchemePage } from "@/components/scheme-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SchemePage
      code="SCHEME_A"
      dataSources={[
        { name: "BDEX public API (mainnet verified)", detail: "53 pairs, 20 pools, 168 chart points, tick-level liquidity distribution verified live on mainnet. Disabled for testnet deployments. Params: pool=, owner= (V2 only)." },
  { name: "BOT Chain RPC filtered getLogs (live)", detail: "27,296 Swap logs over 350k blocks for the USDT/WBOT pool — primary ingestion path." },
  { name: "BOTScan explorer (live)", detail: "Historical transactions/logs; slow (>60s) for very hot addresses — adapter applies timeouts + RPC fallback." }
      ]}
    />
  );
}
