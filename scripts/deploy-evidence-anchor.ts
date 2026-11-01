/** Deploy the EvidenceReportAnchor to BOT Chain testnet using the local wallet file. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import solc from "solc";
import env from "../src/lib/env";

const TESTNET_ID = 968;
const ACCOUNTING_CAP = 2n * 10n ** 18n; // refuse if estimated fee exceeds 2 test BOT
const walletPath = resolve(process.cwd(), ".secrets/bot-testnet-deployer.json");
const sourcePath = resolve(process.cwd(), "contracts/EvidenceReportAnchor.sol");

async function main() {
  if (env.BOT_NETWORK !== "testnet" || env.BOT_CHAIN_ID !== TESTNET_ID) {
    throw new Error("Deployment is locked to BOT_NETWORK=testnet (chain ID 968).");
  }
  if (process.env.CONFIRM_TESTNET_DEPLOY !== "1") {
    throw new Error("Set CONFIRM_TESTNET_DEPLOY=1 to authorize this explicit testnet deployment command.");
  }
  if (!existsSync(walletPath)) throw new Error("The local testnet wallet file is missing.");
  if (!existsSync(sourcePath)) throw new Error("EvidenceReportAnchor.sol is missing.");

  // Read the secret into memory only. It is never logged or written to output.
  const walletRecord = JSON.parse(readFileSync(walletPath, "utf8")) as {
    address: `0x${string}`;
    chainId: number;
    privateKey: Hex;
  };
  if (walletRecord.chainId !== TESTNET_ID) throw new Error("The local wallet record is not for BOT testnet chain ID 968.");
  const account = privateKeyToAccount(walletRecord.privateKey);
  if (account.address.toLowerCase() !== walletRecord.address.toLowerCase()) {
    throw new Error("The local wallet address does not match its private key.");
  }

  const source = readFileSync(sourcePath, "utf8");
  const sourceSha256 = createHash("sha256").update(source).digest("hex");
  const compilerInput = {
    language: "Solidity",
    sources: { "EvidenceReportAnchor.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // Paris avoids reliance on newer EVM opcodes on the testnet.
      evmVersion: "paris",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const compilerOutput = JSON.parse(solc.compile(JSON.stringify(compilerInput))) as {
    errors?: { severity: string; formattedMessage: string }[];
    contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };
  const compileErrors = compilerOutput.errors?.filter((error) => error.severity === "error") ?? [];
  if (compileErrors.length > 0) throw new Error(compileErrors.map((error) => error.formattedMessage).join("\n"));
  const compiled = compilerOutput.contracts?.["EvidenceReportAnchor.sol"]?.EvidenceReportAnchor;
  if (!compiled?.evm.bytecode.object) throw new Error("Solidity compiler returned no deployment bytecode.");

  const chain = {
    id: TESTNET_ID,
    name: "BOT Chain Testnet",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
    rpcUrls: { default: { http: [env.BOT_TESTNET_RPC_URL] } },
    blockExplorers: { default: { name: "BOTScan Testnet", url: env.BOT_TESTNET_EXPLORER_URL } },
  } as const;
  const publicClient = createPublicClient({ chain, transport: http(env.BOT_TESTNET_RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(env.BOT_TESTNET_RPC_URL) });
  const chainId = await publicClient.getChainId();
  if (chainId !== TESTNET_ID) throw new Error(`RPC chain mismatch: expected ${TESTNET_ID}, got ${chainId}.`);

  const balance = await publicClient.getBalance({ address: account.address });
  const bytecode = `0x${compiled.evm.bytecode.object}` as Hex;
  const [estimatedGas, gasPrice] = await Promise.all([
    publicClient.estimateGas({ account: account.address, data: bytecode }),
    publicClient.getGasPrice(),
  ]);
  const gasLimit = estimatedGas + estimatedGas / 5n;
  const maxFee = gasLimit * gasPrice;
  console.log(JSON.stringify({
    action: "deploy EvidenceReportAnchor",
    chainId,
    deployer: account.address,
    balanceBOT: `${balance / 10n ** 18n}.${(balance % 10n ** 18n).toString().padStart(18, "0")}`,
    estimatedGas: estimatedGas.toString(),
    gasLimit: gasLimit.toString(),
    gasPriceWei: gasPrice.toString(),
    maxFeeBOT: `${maxFee / 10n ** 18n}.${(maxFee % 10n ** 18n).toString().padStart(18, "0")}`,
    sourceSha256,
  }, null, 2));

  if (balance === 0n || balance < maxFee) throw new Error("The deployer wallet does not have enough test BOT for this deployment.");
  if (maxFee > ACCOUNTING_CAP) throw new Error("Estimated deployment fee exceeds the 2 BOT safety cap; refusing to submit.");

  const hash = await walletClient.deployContract({
    abi: compiled.abi as never,
    bytecode,
    account,
    chain,
    gas: gasLimit,
    gasPrice,
  });
  console.log(`Submitted deployment transaction: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deployment transaction failed or returned no contract address (status: ${receipt.status}).`);
  }
  const deployedCode = await publicClient.getCode({ address: receipt.contractAddress });
  if (!deployedCode || deployedCode === "0x") throw new Error("No runtime bytecode found at the deployed contract address.");

  const outputDir = resolve(process.cwd(), "deployments");
  mkdirSync(outputDir, { recursive: true });
  const deployment = {
    contract: "EvidenceReportAnchor",
    network: "BOT Chain Testnet",
    chainId: TESTNET_ID,
    address: receipt.contractAddress,
    deployer: account.address,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    gasUsed: receipt.gasUsed.toString(),
    sourceFile: "contracts/EvidenceReportAnchor.sol",
    sourceSha256,
    compiler: solc.version(),
    evmVersion: "paris",
    deployedAt: new Date().toISOString(),
    disclaimer: "Hash anchoring proves only that an account emitted these hashes; it is not official BOT approval or eligibility certification.",
  };
  writeFileSync(resolve(outputDir, "bot-testnet-evidence-anchor.json"), `${JSON.stringify(deployment, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    deployed: true,
    address: receipt.contractAddress,
    transactionHash: hash,
    blockNumber: receipt.blockNumber.toString(),
    explorerAddress: `${env.BOT_TESTNET_EXPLORER_URL}/address/${receipt.contractAddress}`,
    explorerTransaction: `${env.BOT_TESTNET_EXPLORER_URL}/tx/${hash}`,
    artifact: "deployments/bot-testnet-evidence-anchor.json",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
