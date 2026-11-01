import { SchemePage } from "@/components/scheme-page";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SchemePage
      code="SCHEME_B"
      dataSources={[
        { name: "Manual evidence (active)", detail: "Listing URLs and announcements stored as evidence items with verification dates." },
  { name: "CMC ranking snapshots (blocked)", detail: "Qualifying exchange list and authoritative ranking source are unresolved in the official programme." }
      ]}
    />
  );
}
