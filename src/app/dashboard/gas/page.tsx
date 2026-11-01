import { SchemePage } from "@/components/scheme-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SchemePage
      code="GAS_REBATE"
      dataSources={[
        { name: "BOT Chain RPC (live)", detail: "Receipts and gas pricing from live blocks; baseFeePerGas observed 0x0 with priority fees still present." },
  { name: "BOT USD price (live, DeFiLlama)", detail: "Price provenance recorded per point; unpriced days excluded from totals, never zero-filled." }
      ]}
    />
  );
}
