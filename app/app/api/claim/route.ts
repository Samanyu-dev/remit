import { NextResponse } from "next/server";
import { isAddress, isHex } from "viem";
import { ESCROW, escrowAbi } from "@/lib/config";
import { errorMessage, relay } from "@/lib/relayer";

// The relayer can't redirect funds: the contract checks the claim key's signature over `to`.
export async function POST(req: Request) {
  const { id, to, sig } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^\d+$/.test(id) || !isAddress(to) || !isHex(sig) || sig.length !== 132) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const { transactionHash } = await relay({ address: ESCROW, abi: escrowAbi, functionName: "claim", args: [BigInt(id), to, sig] });
    return NextResponse.json({ hash: transactionHash });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
}
