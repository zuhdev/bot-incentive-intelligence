import env from "@/lib/env";

export const CHAINS = {
  mainnet: {
    id: env.BOT_CHAIN_ID,
    name: "BOT Chain",
    rpcUrl: env.BOT_MAINNET_RPC_URL,
    explorerUrl: "https://scan.botchain.ai",
    explorerApi: env.BOTSCAN_API_URL,
    nativeSymbol: "BOT",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  },
  testnet: {
    id: env.BOT_TESTNET_CHAIN_ID,
    name: "BOT Chain Testnet",
    rpcUrl: env.BOT_TESTNET_RPC_URL,
    explorerUrl: "https://scan.bohr.life",
    explorerApi: env.BOT_TESTNET_SCAN_API_URL,
    nativeSymbol: "BOT",
    nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  },
} as const;

export const ACTIVE_CHAIN = env.BOT_NETWORK === "testnet" ? CHAINS.testnet : CHAINS.mainnet;

/**
 * Live addresses discovered during connectivity verification (mainnet 677).
 * See docs/connectivity-report.md for the verification evidence.
 */
export const KNOWN_ADDRESSES = {
  /** BDEX V3 USDT/WBOT pool — busiest pool observed live */
  usdtWbotPool: "0x64f418471a1a7932a190e10da5a8551db5abec05",
  wbot: "0xd5452816194a3784dba983426cce7c122f4abd30",
  usdt: "0xababc7ddc03e501d190c676bf3d92ef0e6e87a3c",
  /** EOA wallet observed interacting with the pool (real trader from live logs) */
  trader: "0xf76ecfbad4313b8daf1e2fe67f30682a9308e07c",
} as const;

/** Well-known event topic signatures (verified against live BOT Chain logs). */
export const TOPICS = {
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  SwapV3: "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67",
  MintV3: "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde",
  BurnV3: "0xdc420dac04262d31bf00627b616e836f722068679ae7f382317a54f8fb28cf43",
  SwapV2: "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822",
} as const;
