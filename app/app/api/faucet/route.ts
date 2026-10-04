import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { publicClient, TOKEN, tokenAbi } from "@/lib/config";
import { errorMessage, relay } from "@/lib/relayer";

// Testnet only: tops an account up to $100 of TestUSD. The relayer pays gas.
export async function POST(req: Request) {
  const { to } = await req.json().catch(() => ({}));
  if (!isAddress(to)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    const bal = await publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [to] });
    if (bal >= 50_000000n) return NextResponse.json({ error: "You already have test dollars" }, { status: 400 });
    await relay({ address: TOKEN, abi: tokenAbi, functionName: "mint", args: [to, 100_000000n - bal] });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 400 });
  }
}
