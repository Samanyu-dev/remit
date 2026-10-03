"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { ESCROW, escrowAbi, publicClient } from "@/lib/config";
import { fmt, parseLink } from "@/lib/money";
import type { Wallet } from "@/lib/wallet";
import { Login } from "../Login";

export default function Claim() {
  const [link, setLink] = useState<ReturnType<typeof parseLink>>();
  const [amount, setAmount] = useState<bigint>();
  const [status, setStatus] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Reads the #fragment, which only exists client-side.
    const l = parseLink(location.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(l);
    if (l) publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "links", args: [l.id] }).then(([, , a]) => setAmount(a));
  }, []);

  async function claim(w: Wallet) {
    try {
      setStatus("Claiming…");
      const to = w.account.address;
      const raw = await publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "claimDigest", args: [link!.id, to] });
      // claimDigest already applies the EIP-191 prefix, so sign the raw digest directly.
      const sig = await privateKeyToAccount(link!.key).sign({ hash: raw });
      const res = await fetch("/api/claim", { method: "POST", body: JSON.stringify({ id: link!.id.toString(), to, sig }) });
      if (!res.ok) throw new Error((await res.json()).error);
      setDone(true);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <h1 className="text-3xl font-semibold">Remit</h1>
      {link === null && <p>This link isn’t valid.</p>}
      {link && amount === undefined && <p className="text-neutral-500">Loading…</p>}
      {link && amount === 0n && !done && <p>This link has already been used, or doesn’t exist.</p>}
      {link && amount !== undefined && amount > 0n && !done && (
        <>
          <p className="text-4xl font-semibold">{fmt(amount)} is waiting for you</p>
          <p className="text-neutral-500">Create an account with your fingerprint or face to receive it. No app needed.</p>
          <Login onWallet={claim} />
        </>
      )}
      {done && <p className="text-2xl">Done! {fmt(amount!)} is in your account. <Link className="underline" href="/">Open Remit</Link></p>}
      {status && !done && <p className="text-sm text-neutral-500">{status}</p>}
    </main>
  );
}
