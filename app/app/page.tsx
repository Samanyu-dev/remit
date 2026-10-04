"use client";
import { useCallback, useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import { post } from "@/lib/api";
import { ESCROW, TOKEN, chain, escrowAbi, publicClient, tokenAbi } from "@/lib/config";
import { fmt, fmtNum, linkFor, toUnits } from "@/lib/money";
import { sealReceipt } from "@/lib/receipts";
import type { Wallet } from "@/lib/wallet";
import { Login } from "./Login";
import { Transactions } from "./Transactions";
import { Avatar, Icon, Logo, Sheet } from "./ui";

const WEEK = 7 * 24 * 3600;
const ReceiveWithAuthorization = [
  { name: "from", type: "address" },
  { name: "to", type: "address" },
  { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" },
  { name: "validBefore", type: "uint256" },
  { name: "nonce", type: "bytes32" },
] as const;

type SheetName = "send" | "link" | "receive" | "add" | null;
const nowSec = () => Math.floor(Date.now() / 1000);
const errText = (e: unknown) => (e as Error).message.split("\n")[0];

export default function Home() {
  const [w, setW] = useState<Wallet>();
  const [bal, setBal] = useState<bigint>();
  const [sheet, setSheet] = useState<SheetName>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [sentAmount, setSentAmount] = useState(0n);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [version, setVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (w) setBal(await publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "balanceOf", args: [w.account.address] }));
  }, [w]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on login
  useEffect(() => { refresh(); }, [refresh]);

  const open = (s: SheetName) => { setMsg(""); setSheet(s); };
  const value = (() => { try { return toUnits(amount || "0"); } catch { return 0n; } })();
  const tooMuch = bal !== undefined && value > bal;

  async function send() {
    setBusy(true); setMsg("");
    try {
      const from = w!.account.address;
      const key = generatePrivateKey();
      const claimKey = privateKeyToAddress(key);
      const now = nowSec();
      const expiry = BigInt(now + WEEK);
      const validBefore = BigInt(now + 3600);
      const [name, nonce] = await Promise.all([
        publicClient.readContract({ address: TOKEN, abi: tokenAbi, functionName: "name" }),
        publicClient.readContract({ address: ESCROW, abi: escrowAbi, functionName: "authNonce", args: [claimKey, expiry] }),
      ]);
      // One signature, no gas: authorizes the escrow to pull exactly `value` for this claim key.
      const sig = await w!.account.signTypedData({
        domain: { name, version: "1", chainId: chain.id, verifyingContract: TOKEN },
        types: { ReceiveWithAuthorization },
        primaryType: "ReceiveWithAuthorization",
        message: { from, to: ESCROW, value, validAfter: 0n, validBefore, nonce },
      });
      const memo = await sealReceipt(w!.receiptsKey, { note, key });
      const { id } = await post("/api/send", {
        from, claimKey, sig, memo, amount: value.toString(), expiry: expiry.toString(), validBefore: validBefore.toString(),
      });
      setLink(linkFor(location.origin, BigInt(id), key));
      setSentAmount(value);
      setAmount(""); setNote(""); setSheet("link");
      setVersion((v) => v + 1); refresh();
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      if (navigator.share) return await navigator.share({ text: `I sent you ${fmt(sentAmount)} with Remit. Tap to claim: ${link}` });
    } catch (e) {
      // Closing the share sheet, or tapping while it's open, isn't an error worth showing.
      if (["AbortError", "InvalidStateError"].includes((e as Error).name)) return;
    }
    await navigator.clipboard.writeText(link);
    setMsg("Link copied");
  }

  async function addTestDollars() {
    setBusy(true); setMsg("");
    try {
      await post("/api/faucet", { to: w!.account.address });
      await refresh();
      setSheet(null);
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  }

  if (!w) {
    return (
      <main className="screen justify-between">
        <Logo />
        <div className="flex flex-col gap-4">
          <h1 className="text-[38px] font-bold leading-[1.08] tracking-tight">
            Send dollars anywhere.<br />
            <span className="text-white/50">As easy as a text.</span>
          </h1>
          <p className="text-mute">Send money as a link over WhatsApp or SMS. They tap, smile at their phone, and it’s theirs. No bank details, no fees, no app to install.</p>
        </div>
        <Login onWallet={setW} />
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="flex items-center justify-between">
        <Logo />
        <Avatar address={w.account.address} />
      </header>

      <section className="glass flex flex-col items-center gap-3 px-6 pb-7 pt-5">
        <div className="flex w-full items-center justify-between text-sm text-white/80">
          <span>Remit balance</span>
          <button onClick={() => { refresh(); setVersion((v) => v + 1); }} aria-label="Refresh" className="text-white/70 active:rotate-180 transition">
            <Icon name="refresh" />
          </button>
        </div>
        <span className="pill mt-2"><span aria-hidden>🇺🇸</span> USD wallet</span>
        <p className="mt-2 text-sm text-mute">Available balance</p>
        <p className="flex items-baseline gap-2">
          <span className="text-[52px] font-bold leading-none tracking-tight tabular-nums">{bal === undefined ? "—" : fmtNum(bal)}</span>
          <span className="text-mute">US$</span>
        </p>
      </section>

      <nav className="flex gap-3">
        <button className="action" onClick={() => open("send")}><Icon name="send" />Send</button>
        <button className="action" onClick={() => open("receive")}><Icon name="receive" />Receive</button>
        <button className="action" onClick={() => open("add")}><Icon name="add" />Add</button>
      </nav>

      <Transactions w={w} version={version} />

      {sheet === "send" && (
        <Sheet title="Send money" onClose={() => setSheet(null)}>
          <label className="flex items-baseline justify-center gap-1 py-4">
            <span className="text-4xl font-bold text-white/40">$</span>
            <input
              autoFocus inputMode="decimal" placeholder="0" value={amount}
              onChange={(e) => /^\d*\.?\d{0,2}$/.test(e.target.value) && setAmount(e.target.value)}
              className="w-48 bg-transparent text-center text-6xl font-bold tabular-nums outline-none placeholder:text-white/20"
              aria-label="Amount in US dollars"
            />
          </label>
          <p className={`text-center text-sm ${tooMuch ? "text-down" : "text-mute"}`}>
            {tooMuch ? "That’s more than your balance" : `Balance ${bal === undefined ? "—" : fmt(bal)}`}
          </p>
          <input className="input" maxLength={100} placeholder="What’s it for? (only you can read this)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn" disabled={!value || tooMuch || busy} onClick={send}>
            {busy ? "Creating link…" : value ? `Send ${fmt(value)}` : "Enter an amount"}
          </button>
          <p className="text-center text-xs text-mute">You’ll get a link to share. Unclaimed money can be returned after 7 days.</p>
          {msg && <p className="text-center text-sm text-down">{msg}</p>}
        </Sheet>
      )}

      {sheet === "link" && (
        <Sheet title="Link ready" onClose={() => setSheet(null)}>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="grid size-16 place-items-center rounded-full bg-up/15 text-up"><Icon name="check" className="size-8" /></div>
            <p className="text-3xl font-bold">{fmt(sentAmount)}</p>
            <p className="text-mute">Send this link to anyone. Whoever opens it first gets the money, so share it privately.</p>
          </div>
          <button className="btn" onClick={share}>Share link</button>
          <button className="btn-ghost" onClick={() => { navigator.clipboard.writeText(link); setMsg("Link copied"); }}>Copy link</button>
          {msg && <p className="text-center text-sm text-up">{msg}</p>}
        </Sheet>
      )}

      {sheet === "receive" && (
        <Sheet title="Receive money" onClose={() => setSheet(null)}>
          <p className="text-mute">Ask anyone with Remit to send you a link. When you open it, the money lands here, in your USD wallet. There are no account numbers to share.</p>
          <div className="glass flex items-center gap-3 p-4">
            <Avatar address={w.account.address} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-mute">Your account</p>
              <p className="truncate font-mono text-sm">{w.account.address}</p>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(w.account.address); setMsg("Copied"); }} aria-label="Copy account address" className="text-white/70"><Icon name="copy" /></button>
          </div>
          {msg && <p className="text-center text-sm text-up">{msg}</p>}
        </Sheet>
      )}

      {sheet === "add" && (
        <Sheet title="Add money" onClose={() => setSheet(null)}>
          <p className="text-mute">Remit is on Monad testnet, so you can add free test dollars to try it out.</p>
          <button className="btn" disabled={busy} onClick={addTestDollars}>{busy ? "Adding…" : "Add $100 test dollars"}</button>
          {msg && <p className="text-center text-sm text-down">{msg}</p>}
        </Sheet>
      )}
    </main>
  );
}
