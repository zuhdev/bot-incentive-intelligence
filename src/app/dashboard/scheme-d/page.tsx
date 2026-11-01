import { SchemePage } from "@/components/scheme-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SchemePage
      code="SCHEME_D"
      dataSources={[
        { name: "DeFiLlama (mainnet verified)", detail: "BOT Chain (chainId 677) and bdex-v3 historical TVL were verified on mainnet. Mainnet-only; disabled in testnet mode. Coverage starts 2026-08-24." },
  { name: "Asset registry (configurable)", detail: "Complete approved-asset whitelist not public — unverified assets are pending_review and NEVER counted as qualified." }
      ]}
    />
  );
}
