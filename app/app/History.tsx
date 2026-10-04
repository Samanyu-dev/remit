"use client";
import { useEffect, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import { ESCROW, escrowAbi, publicClient } from "@/lib/config";
import { fmt, linkFor } from "@/lib/money";
import { openReceipt, type Receipt } from "@/lib/receipts";
import type { Wallet } from "@/lib/wallet";

type Row = { id: bigint; amount: bigint; pending: boolean; receipt: Receipt | null };

export function History({ w, version }: { w: Wallet; version: number }) {
  const [rows, setRows] = useState<Row[]>();
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/history?sender=${w.account.address}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const sent = body.logs.map((l: { topics: [Hex, ...Hex[]]; data: Hex }) =>
        decodeEventLog({ abi: escrowAbi, eventName: "Sent", topics: l.topics, data: l.data }).args,
      );
      const out = await Promise.all(
        sent.map(async (a: { id: bigint; amount: bigint; memo: Hex }) => {
          const [, , left] = await publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "links", args: [a.id] });
          return { id: a.id, amount: a.amount, pending: left > 0n, receipt: await openReceipt(w.receiptsKey, a.memo) };
        }),
      );
      setRows(out.reverse());
    })().catch((e) => setErr(e.message));
  }, [w, version]);

  if (err) return <p className="text-sm text-neutral-500">History: {err}</p>;
  if (!rows) return <p className="text-sm text-neutral-500">Loading history…</p>;
  if (!rows.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">Sent · notes are encrypted to your passkey</p>
      {rows.map((r) => (
        <div key={r.id} className="card flex items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{fmt(r.amount)}</p>
            <p className="truncate text-sm text-neutral-500">{r.receipt?.note || "No note"}</p>
          </div>
          {r.pending && r.receipt ? (
            <button className="text-sm underline" onClick={() => navigator.clipboard.writeText(linkFor(location.origin, r.id, r.receipt!.key))}>
              Copy link
            </button>
          ) : (
            <span className="text-sm text-neutral-500">{r.pending ? "Waiting" : "Claimed"}</span>
          )}
        </div>
      ))}
    </div>
  );
}
