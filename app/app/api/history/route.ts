import { NextResponse } from "next/server";
import { encodeEventTopics, isAddress, pad } from "viem";
import { ESCROW, escrowAbi } from "@/lib/config";

// Envio HyperSync: Monad's RPC caps eth_getLogs at ~100 blocks (under a minute of history),
// so payment history comes from HyperSync, which scans the whole chain in one paginated query.
const HYPERSYNC = "https://monad-testnet.hypersync.xyz/query";
const [SENT] = encodeEventTopics({ abi: escrowAbi, eventName: "Sent" });

type HsLog = { block_number: number; data: string; topic0: string; topic1: string; topic2: string; topic3: string };

export async function GET(req: Request) {
  const sender = new URL(req.url).searchParams.get("sender");
  if (!sender || !isAddress(sender)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const logs: HsLog[] = [];
  let from = Number(process.env.ESCROW_FROM_BLOCK ?? 0);
  for (let page = 0; page < 20; page++) {
    const res = await fetch(HYPERSYNC, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ENVIO_API_TOKEN}` },
      body: JSON.stringify({
        from_block: from,
        logs: [{ address: [ESCROW], topics: [[SENT], [], [pad(sender)]] }],
        field_selection: { log: ["block_number", "data", "topic0", "topic1", "topic2", "topic3"] },
      }),
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: `history unavailable (${res.status})` }, { status: 502 });
    const body = await res.json();
    // The response carries logs either directly or in batches, depending on API version.
    const batches = Array.isArray(body.data) ? body.data : [body.data];
    for (const b of batches) logs.push(...(b?.logs ?? []));
    if (body.next_block >= body.archive_height) break;
    from = body.next_block;
  }
  return NextResponse.json({
    logs: logs.map((l) => ({ topics: [l.topic0, l.topic1, l.topic2, l.topic3], data: l.data, block: l.block_number })),
  });
}
