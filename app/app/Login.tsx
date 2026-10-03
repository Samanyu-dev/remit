"use client";
import { useState } from "react";
import { signIn, signUp, type Wallet } from "@/lib/wallet";

export function Login({ onWallet }: { onWallet: (w: Wallet) => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const run = (f: () => Promise<Wallet>) => () => f().then(onWallet, (e) => setErr(e.message));
  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" disabled={!name} onClick={run(() => signUp(name))}>Create account with passkey</button>
      <button className="btn-ghost" onClick={run(signIn)}>I already have one</button>
      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}
