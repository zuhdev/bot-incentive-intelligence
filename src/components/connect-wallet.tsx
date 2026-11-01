"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Wallet connection via injected provider (MetaMask et al.).
 * Ownership is proven by signing a plain-text message — the flow never
 * requests transactions or transfers.
 */
export function ConnectWallet({ onConnected }: { onConnected?: () => void }) {
  const [state, setState] = useState<"idle" | "challenging" | "signing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    const eth = (window as unknown as { ethereum?: any }).ethereum;
    if (!eth) {
      setError("No injected wallet found. Install MetaMask (or any EIP-1193 wallet) configured for the selected BOT Chain network.");
      setState("error");
      return;
    }
    try {
      setState("challenging");
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      setAddress(addr);

      const networkRes = await fetch("/api/network", { cache: "no-store" });
      if (!networkRes.ok) throw new Error("Could not read the configured BOT network.");
      const network = await networkRes.json();
      const targetChainHex = `0x${Number(network.chainId).toString(16)}`;
      const currentChain = String(await eth.request({ method: "eth_chainId" })).toLowerCase();
      if (currentChain !== targetChainHex.toLowerCase()) {
        try {
          await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetChainHex }] });
        } catch (switchError) {
          const code = (switchError as { code?: number }).code;
          if (code !== 4902) throw switchError;
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: targetChainHex,
              chainName: network.name,
              nativeCurrency: network.nativeCurrency,
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.explorerUrl],
            }],
          });
        }
      }

      const res = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "challenge failed");
      const { message } = await res.json();

      setState("signing");
      const signature: string = await eth.request({
        method: "personal_sign",
        params: [message, addr],
      });

      const verify = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr, signature }),
      });
      if (!verify.ok) {
        const body = await verify.json();
        throw new Error(body.error ?? "verification failed");
      }
      setState("idle");
      onConnected?.();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [onConnected]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setAddress(d.user.displayName);
      })
      .catch(() => undefined);
  }, []);

  if (address && state !== "error") {
    return (
      <span className="rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 font-mono text-xs text-[var(--color-accent-green)]">
        {address.slice(0, 6)}…{address.slice(-4)} connected
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={connect}
        disabled={state === "challenging" || state === "signing"}
        className="rounded-md bg-[var(--color-accent-green)] px-4 py-2 text-sm font-medium text-[#04120c] hover:brightness-110 disabled:opacity-60"
      >
        {state === "challenging" ? "Preparing challenge…" : state === "signing" ? "Waiting for signature…" : "Connect wallet"}
      </button>
      {error && <p className="max-w-xs text-right text-xs text-[var(--color-red)]">{error}</p>}
      <p className="max-w-xs text-right text-[10px] text-[var(--color-text-muted)]">
        Signing proves ownership only. No private keys, seed phrases or fund transfers are ever requested.
      </p>
    </div>
  );
}
