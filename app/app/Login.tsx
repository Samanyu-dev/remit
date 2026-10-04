"use client";
import { useState } from "react";
import { signIn, signUp, type Wallet } from "@/lib/wallet";

export function Login({ onWallet, cta = "Continue with passkey" }: { onWallet: (w: Wallet) => void; cta?: string }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<Wallet>) => async () => {
    setBusy(true); setErr("");
    try { onWallet(await f()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" disabled={!name || busy} onClick={run(() => signUp(name))}>{cta}</button>
      <button className="btn-ghost" disabled={busy} onClick={run(signIn)}>I already have an account</button>
      <p className="text-center text-xs text-mute">Your face or fingerprint is your key. No passwords, no seed phrases.</p>
      {err && <p className="text-center text-sm text-down">{err}</p>}
    </div>
  );
}
