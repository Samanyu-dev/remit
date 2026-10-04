"use client";
import { useCallback, useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { post } from "@/lib/api";
import { ESCROW, TOKEN, chain, escrowAbi, publicClient, tokenAbi } from "@/lib/config";
import { fmt, linkFor, toUnits } from "@/lib/money";
import type { Wallet } from "@/lib/wallet";
import { Login } from "./Login";

const WEEK = 7 * 24 * 3600;
const ReceiveWithAuthorization = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
] as const;

export default function Home() {
  const [w, setW] = useState<Wallet>();
  const [bal, setBal] = useState<bigint>();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");
  const [link, setLink] = useState("");

  const refresh = useCallback(async () => {
    if (w) setBal(await publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [w.account.address] }));
  }, [w]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on login
  useEffect(() => { refresh(); }, [refresh]);

  async function send() {
    try {
      setStatus("Sending…");
      const value = toUnits(amount);
      const from = w!.account.address;
      const key = generatePrivateKey();
      const claimKey = privateKeyToAddress(key);
      const now = Math.floor(Date.now() / 1000);
      const expiry = BigInt(now + WEEK);
      const validBefore = BigInt(now + 3600);
      const [name, nonce] = await Promise.all([
        publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "name" }),
        publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "authNonce", args: [claimKey, expiry] }),
      ]);
      // One signature, no gas: authorizes the escrow to pull exactly `value` for this claim key.
      const sig = await w!.account.signTypedData({
        domain: { name, version: "1", chainId: chain.id, verifyingContract: TOKEN },
        types: { ReceiveWithAuthorization },
        primaryType: "ReceiveWithAuthorization",
        message: { from, to: ESCROW, value, validAfter: 0n, validBefore, nonce },
      });
      const { id } = await post("/api/send", {
        from, claimKey, sig, amount: value.toString(), expiry: expiry.toString(), validBefore: validBefore.toString(),
      });
      setLink(linkFor(location.origin, BigInt(id), key));
      setStatus(""); setAmount(""); refresh();
    } catch (e) {
      setStatus((e as Error).message.split("\n")[0]);
    }
  }

  async function faucet() {
    setStatus("Getting test dollars…");
    try {
      await post("/api/faucet", { to: w!.account.address });
      setStatus("");
    } catch (e) {
      setStatus((e as Error).message);
    }
    refresh();
  }

  const share = () => (navigator.share ? navigator.share({ text: `I sent you money. Tap to claim: ${link}` }) : navigator.clipboard.writeText(link));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Remit</h1>
      {!w ? (
        <><p className="text-neutral-500">Send dollars anywhere, as a link.</p><Login onWallet={setW} /></>
      ) : (
        <>
          <div className="card">
            <p className="text-sm text-neutral-500">Balance</p>
            <p className="text-4xl font-semibold">{bal === undefined ? "…" : fmt(bal)}</p>
            <button className="mt-2 text-sm underline" onClick={faucet}>Add $100 test dollars</button>
          </div>
          {link ? (
            <div className="card flex flex-col gap-3">
              <p>Link ready. Whoever opens it can claim the money.</p>
              <button className="btn" onClick={share}>Share link</button>
              <button className="btn-ghost" onClick={() => setLink("")}>Send another</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input className="input text-2xl" inputMode="decimal" placeholder="$0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="btn" disabled={!Number(amount) || !!status} onClick={send}>Create payment link</button>
            </div>
          )}
          {status && <p className="text-sm text-neutral-500">{status}</p>}
          <p className="break-all text-xs text-neutral-400">{w.account.address}</p>
        </>
      )}
    </main>
  );
}
