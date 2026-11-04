/** Independently verify the committed mainnet EvidenceReportAnchor deployment record. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, http } from "viem";
import env from "../src/lib/env";

async function main() {
  if (env.BOT_NETWORK !== "mainnet" || env.BOT_CHAIN_ID !== 677) {
    throw new Error("Run mainnet deployment verification with BOT_NETWORK=mainnet (chain ID 677).");
  }
  const deployment = JSON.parse(
    readFileSync(resolve(process.cwd(), "deployments/bot-mainnet-evidence-anchor.json"), "utf8"),
  ) as { address: `0x${string}`; transactionHash: `0x${string}`; sourceSha256: string; blockNumber: string };
  const source = readFileSync(resolve(process.cwd(), "contracts/EvidenceReportAnchor.sol"));
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  if (sourceSha256 !== deployment.sourceSha256) throw new Error("Contract source hash differs from the deployment record.");

  const client = createPublicClient({
    chain: {
      id: 677,
      name: "BOT Chain",
      nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
      rpcUrls: { default: { http: [env.BOT_MAINNET_RPC_URL] } },
    },
    transport: http(env.BOT_MAINNET_RPC_URL),
  });
  const [chainId, receipt, code] = await Promise.all([
    client.getChainId(),
    client.getTransactionReceipt({ hash: deployment.transactionHash }),
    client.getCode({ address: deployment.address }),
  ]);
  if (chainId !== 677) throw new Error(`Unexpected chain ID ${chainId}.`);
  if (receipt.status !== "success") throw new Error(`Deployment receipt status is ${receipt.status}.`);
  if (receipt.contractAddress?.toLowerCase() !== deployment.address.toLowerCase()) {
    throw new Error("Receipt contract address does not match deployments/bot-mainnet-evidence-anchor.json.");
  }
  if (!code || code === "0x") throw new Error("No runtime bytecode at the deployed contract address.");

  const explorerResponse = await fetch(`${env.BOT_MAINNET_SCAN_API_URL}/v2/addresses/${deployment.address}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const explorerData = explorerResponse.ok ? await explorerResponse.json() as { is_contract?: boolean } : null;

  console.log(JSON.stringify({
    verified: true,
    chainId,
    address: deployment.address,
    transactionHash: deployment.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    runtimeBytecodeBytes: (code.length - 2) / 2,
    sourceSha256,
    explorerHTTP: explorerResponse.status,
    explorerRecognizesContract: explorerData?.is_contract ?? null,
    explorerAddress: `${env.BOT_MAINNET_EXPLORER_URL}/address/${deployment.address}`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
