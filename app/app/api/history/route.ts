import { NextResponse } from "next/server";
import { decodeEventLog, encodeEventTopics, isAddress, pad, type Hex } from "viem";
import { ESCROW, escrowAbi } from "@/lib/config";
import { hypersync, type HsLog } from "@/lib/hypersync";

const abi = escrowAbi;
const [SENT] = encodeEventTopics({ abi, eventName: "Sent" });
const [CLAIMED] = encodeEventTopics({ abi, eventName: "Claimed" });

const sentArgs = (l: HsLog) =>
  decodeEventLog({ abi, eventName: "Sent", topics: [l.topic0, l.topic1, l.topic2, l.topic3] as [Hex, ...Hex[]], data: l.data as Hex }).args;

// Everything the app's transaction list needs: links I sent (with my encrypted memos) and links I claimed.
export async function GET(req: Request) {
  const addr = new URL(req.url).searchParams.get("addr");
  if (!addr || !isAddress(addr)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const me = pad(addr);
    const mine = await hypersync([
      { address: [ESCROW], topics: [[SENT], [], [me]] },
      { address: [ESCROW], topics: [[CLAIMED], [], [me]] },
    ]);
    const claimedIds = mine.filter((l) => l.topic0 === CLAIMED).map((l) => l.topic1);
    // Amounts for links I claimed live on their Sent events.
    const claimedSent = claimedIds.length ? await hypersync([{ address: [ESCROW], topics: [[SENT], claimedIds] }]) : [];
    const claimTime = new Map(mine.filter((l) => l.topic0 === CLAIMED).map((l) => [l.topic1, l.time]));

    const sent = mine.filter((l) => l.topic0 === SENT).map((l) => {
      const a = sentArgs(l);
      return { kind: "sent", id: a.id.toString(), amount: a.amount.toString(), memo: a.memo, time: l.time };
    });
    const received = claimedSent.map((l) => {
      const a = sentArgs(l);
      return { kind: "received", id: a.id.toString(), amount: a.amount.toString(), from: a.sender, time: claimTime.get(l.topic1) ?? l.time };
    });
    return NextResponse.json({ items: [...sent, ...received].sort((x, y) => (y.time ?? 0) - (x.time ?? 0)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
