import { SchemePage } from "@/components/scheme-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SchemePage
      code="SCHEME_C"
      dataSources={[
        { name: "BOTScan wallet history (live)", detail: "Historical transactions + token transfers per wallet (50/page, cursor pagination)." },
  { name: "BOT Chain RPC (live)", detail: "Native BOT balances via eth_getBalance; filtered logs for activity indexing." },
  { name: "Wallet first-seen (live, bounded)", detail: "Bounded backward page-walk to find first on-chain transaction (wallet age)." }
      ]}
    />
  );
}
