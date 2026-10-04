import { NextResponse } from "next/server";
import { isAddress, isHex, parseEventLogs, parseSignature } from "viem";
import { ESCROW, escrowAbi } from "@/lib/config";
import { errorMessage, relay } from "@/lib/relayer";

const uint = (v: unknown) => typeof v === "string" && /^\d{1,30}$/.test(v);

// The sender's EIP-3009 signature binds amount, claim key and expiry, so the relayer can only submit it as-is.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (!isAddress(b.from) || !isAddress(b.claimKey) || !uint(b.amount) || !uint(b.expiry) || !uint(b.validBefore) || !isHex(b.sig) || b.sig.length !== 132) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const { v, r, s } = parseSignature(b.sig);
    const receipt = await relay({
      address: ESCROW,
      abi: escrowAbi,
      functionName: "sendWithAuthorization",
      args: [b.from, BigInt(b.amount), b.claimKey, BigInt(b.expiry), BigInt(b.validBefore), Number(v), r, s],
    });
    const [ev] = parseEventLogs({ abi: escrowAbi, eventName: "Sent", logs: receipt.logs });
    return NextResponse.json({ id: ev.args.id.toString(), hash: receipt.transactionHash });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
}
