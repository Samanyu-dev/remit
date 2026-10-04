"use client";
import { useState } from "react";
import { signIn, signUp, type Wallet } from "@/lib/wallet";

export function Login({ onWallet, cta = "Continue with passkey" }: { onWallet: (w: Wallet) => void; cta?: string }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (f: () => Promise<Wallet>, signingIn = false) => async () => {
    setBusy(true); setErr("");
    try {
      onWallet(await f());
    } catch (e) {
      const code = (e as { code?: string }).code;
      setErr(
        code === "PRF_UNAVAILABLE"
          ? "This passkey manager can’t be used with Remit yet. Try Safari with iCloud Keychain, or Chrome with Google Password Manager."
          : signingIn
            ? "No Remit account found on this device. New here? Enter your name and tap the button above."
            : "Passkey wasn’t created. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <input className="input" placeholder="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn" disabled={!name || busy} onClick={run(() => signUp(name))}>{cta}</button>
      <button className="btn-ghost" disabled={busy} onClick={run(signIn, true)}>I already have an account</button>
      <p className="text-center text-xs text-mute">Your face or fingerprint is your key. No passwords, no seed phrases.</p>
      {err && <p className="text-center text-sm text-down">{err}</p>}
    </div>
  );
}
