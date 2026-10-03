"use client";
import { useCallback, useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { maxUint256, parseEventLogs } from "viem";
import { ESCROW, TOKEN, escrowAbi, publicClient, tokenAbi } from "@/lib/config";
import { fmt, linkFor, toUnits } from "@/lib/money";
import type { Wallet } from "@/lib/wallet";
import { Login } from "./Login";

const WEEK = 7 * 24 * 3600;

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

  async function tx(p: Parameters<Wallet["wallet"]["writeContract"]>[0]) {
    const hash = await w!.wallet.writeContract(p);
    return publicClient.waitForTransactionReceipt({ hash });
  }

  async function send() {
    try {
      const value = toUnits(amount);
      setStatus("Approving…");
      const allowance = await publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "allowance", args: [w!.account.address, ESCROW] });
      if (allowance < value) await tx({ address: TOKEN, abi: tokenAbi, functionName: "approve", args: [ESCROW, maxUint256] } as never);
      setStatus("Sending…");
      const key = generatePrivateKey();
      const expiry = BigInt(Math.floor(Date.now() / 1000) + WEEK);
      const receipt = await tx({ address: ESCROW, abi: escrowAbi, functionName: "send", args: [value, privateKeyToAddress(key), expiry] } as never);
      const [ev] = parseEventLogs({ abi: escrowAbi, eventName: "Sent", logs: receipt.logs });
      setLink(linkFor(location.origin, ev.args.id, key));
      setStatus(""); setAmount(""); refresh();
    } catch (e) {
      setStatus((e as Error).message.split("\n")[0]);
    }
  }

  async function faucet() {
    setStatus("Getting test dollars…");
    await tx({ address: TOKEN, abi: tokenAbi, functionName: "mint", args: [w!.account.address, toUnits("100")] } as never).catch((e) => setStatus(e.message.split("\n")[0]));
    setStatus(""); refresh();
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
