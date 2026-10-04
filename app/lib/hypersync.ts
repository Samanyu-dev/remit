import "server-only";

// Envio HyperSync: Monad's RPC caps eth_getLogs at ~100 blocks (under a minute of history),
// so history comes from HyperSync, which scans the whole chain in one paginated query.
const URL = "https://monad-testnet.hypersync.xyz/query";

export type HsLog = { block_number: number; data: string; topic0: string; topic1: string; topic2: string; topic3: string };

export async function hypersync(logs: object[]) {
  const out: HsLog[] = [];
  const times = new Map<number, number>();
  let from = Number(process.env.ESCROW_FROM_BLOCK ?? 0);
  for (let page = 0; page < 20; page++) {
    const res = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.ENVIO_API_TOKEN}` },
      body: JSON.stringify({
        from_block: from,
        logs,
        field_selection: {
          log: ["block_number", "data", "topic0", "topic1", "topic2", "topic3"],
          block: ["number", "timestamp"],
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`history unavailable (${res.status})`);
    const body = await res.json();
    // The response carries data either directly or in batches, depending on API version.
    for (const b of Array.isArray(body.data) ? body.data : [body.data]) {
      out.push(...(b?.logs ?? []));
      for (const blk of b?.blocks ?? []) times.set(Number(blk.number), Number(blk.timestamp));
    }
    if (body.next_block >= body.archive_height) break;
    from = body.next_block;
  }
  return out.map((l) => ({ ...l, time: times.get(Number(l.block_number)) ?? null }));
}
