import { NextResponse } from "next/server";
import { createWalletClient, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, transport, ESCROW, escrowAbi, publicClient } from "@/lib/config";

// Relayer: pays gas for claims so recipients with brand-new accounts need no MON.
// It can't redirect funds: the contract checks the claim key's signature over `to`.
export async function POST(req: Request) {
  const { id, to, sig } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^\d+$/.test(id) || !isAddress(to) || !isHex(sig) || sig.length !== 132) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport: transport() });
  try {
    const { request } = await publicClient.simulateContract({
      account, address: ESCROW, abi: escrowAbi, functionName: "claim", args: [BigInt(id), to, sig],
    });
    const hash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash });
    return NextResponse.json({ hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : "claim failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
