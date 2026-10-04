"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { post } from "@/lib/api";
import { ESCROW, escrowAbi, publicClient } from "@/lib/config";
import { fmt, parseLink } from "@/lib/money";
import type { Wallet } from "@/lib/wallet";
import { Login } from "../Login";
import { Icon, Logo } from "../ui";

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
      await post("/api/claim", { id: link!.id.toString(), to, sig });
      setDone(true);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  const live = link && amount !== undefined && amount > 0n;
  return (
    <main className="screen justify-between">
      <Logo />
      <section className="glass flex flex-col items-center gap-3 px-6 py-10 text-center">
        {link === null && <p className="text-lg">This link isn’t valid.</p>}
        {link && amount === undefined && <div className="h-24 w-48 animate-pulse rounded-2xl bg-white/5" />}
        {link && amount === 0n && !done && <p className="text-lg">This link has already been used, or doesn’t exist.</p>}
        {live && !done && (
          <>
            <p className="text-mute">Someone sent you</p>
            <p className="text-[56px] font-bold leading-none tracking-tight tabular-nums">{fmt(amount)}</p>
            <span className="pill"><span aria-hidden>🇺🇸</span> US dollars</span>
          </>
        )}
        {done && (
          <>
            <div className="grid size-16 place-items-center rounded-full bg-up/15 text-up"><Icon name="check" className="size-8" /></div>
            <p className="text-3xl font-bold">{fmt(amount!)} is yours</p>
            <p className="text-mute">It’s in your Remit USD wallet.</p>
          </>
        )}
      </section>
      {live && !done && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-mute">Create your account with Face ID or your fingerprint to receive it. It takes 5 seconds.</p>
          <Login onWallet={claim} cta="Claim with passkey" />
          {status && <p className="text-center text-sm text-mute">{status}</p>}
        </div>
      )}
      {done && <Link href="/" className="btn text-center">Open my wallet</Link>}
      {(link === null || amount === 0n) && !done && <Link href="/" className="btn text-center">Go to Remit</Link>}
    </main>
  );
}
