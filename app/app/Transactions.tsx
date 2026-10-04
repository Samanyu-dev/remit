"use client";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { ESCROW, escrowAbi, publicClient } from "@/lib/config";
import { fmtNum, linkFor } from "@/lib/money";
import { openReceipt, type Receipt } from "@/lib/receipts";
import type { Wallet } from "@/lib/wallet";
import { Icon } from "./ui";

type Item = { kind: "sent" | "received"; id: string; amount: string; memo?: Hex; time: number | null };
type Row = Item & { pending: boolean; receipt: Receipt | null };

const when = (t: number | null) =>
  t ? new Date(t * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Just now";

export function Transactions({ w, version }: { w: Wallet; version: number }) {
  const [rows, setRows] = useState<Row[]>();
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/history?addr=${w.account.address}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setRows(
        await Promise.all(
          (body.items as Item[]).map(async (it) => {
            if (it.kind === "received") return { ...it, pending: false, receipt: null };
            const [, , left] = await publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "links", args: [BigInt(it.id)] });
            return { ...it, pending: left > 0n, receipt: await openReceipt(w.receiptsKey, it.memo!) };
          }),
        ),
      );
    })().catch((e) => setErr(e.message));
  }, [w, version]);

  async function copy(r: Row) {
    await navigator.clipboard.writeText(linkFor(location.origin, BigInt(r.id), r.receipt!.key));
    setCopied(r.id);
    setTimeout(() => setCopied(""), 1500);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white/70">Transactions</h2>
        <span className="pill text-xs text-white/80">Recent</span>
      </div>
      <div className="glass flex flex-col divide-y divide-white/5 overflow-hidden">
        {err && <p className="p-5 text-sm text-mute">{err}</p>}
        {!rows && !err && [0, 1].map((i) => <div key={i} className="m-4 h-12 animate-pulse rounded-xl bg-white/5" />)}
        {rows?.length === 0 && <p className="p-6 text-center text-sm text-mute">No payments yet. Tap Send to make your first link.</p>}
        {rows?.map((r) => {
          const sent = r.kind === "sent";
          return (
            <div key={r.kind + r.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className={`grid size-11 shrink-0 place-items-center rounded-full ${sent ? "bg-down/15 text-down" : "bg-up/15 text-up"}`}>
                <Icon name={sent ? "send" : "receive"} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{sent ? r.receipt?.note || "Payment link" : "Money received"}</p>
                <p className="text-xs text-mute">
                  {when(r.time)}
                  {sent && (r.pending ? " · Waiting to be claimed" : " · Claimed")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className={`font-semibold tabular-nums ${sent ? "" : "text-up"}`}>
                  {sent ? "−" : "+"}{fmtNum(BigInt(r.amount))} <span className="text-xs font-normal text-mute">US$</span>
                </p>
                {sent && r.pending && r.receipt && (
                  <button onClick={() => copy(r)} className="flex items-center gap-1 text-xs text-white/70">
                    <Icon name={copied === r.id ? "check" : "copy"} className="size-3.5" />
                    {copied === r.id ? "Copied" : "Copy link"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {rows?.some((r) => r.receipt) && <p className="text-center text-xs text-mute">Notes are encrypted on-chain. Only your passkey can read them.</p>}
    </section>
  );
}
