/** Check the locally stored testnet deployer balance without loading its key. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, formatUnits, http } from "viem";

const walletPath = resolve(process.cwd(), ".secrets/bot-testnet-deployer.json");
if (!existsSync(walletPath)) throw new Error("Local testnet wallet file is missing.");

const wallet = JSON.parse(readFileSync(walletPath, "utf8")) as {
  address: `0x${string}`;
  chainId: number;
  network: string;
};
if (wallet.chainId !== 968) throw new Error(`Wallet record has unexpected chain ID ${wallet.chainId}.`);

const client = createPublicClient({
  chain: {
    id: 968,
    name: "BOT Chain Testnet",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
  },
  transport: http("https://rpc.bohr.life"),
});

async function main() {
  const [chainId, blockNumber, balance] = await Promise.all([
    client.getChainId(),
    client.getBlockNumber(),
    client.getBalance({ address: wallet.address }),
  ]);
  if (chainId !== wallet.chainId) throw new Error(`RPC chain ID mismatch: expected ${wallet.chainId}, got ${chainId}.`);

  console.log(JSON.stringify({
    network: wallet.network,
    chainId,
    address: wallet.address,
    latestBlock: blockNumber.toString(),
    balanceBOT: formatUnits(balance, 18),
    funded: balance > 0n,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
