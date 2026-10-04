"use client";
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
} from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { HDKey } from "@scure/bip32";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

// Passkeys are bound to the domain, so the same passkey works on every page of this site.
const rpId = () => window.location.hostname;

function accountFromPrf(prfOutput: Uint8Array) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0");
  if (!node.privateKey) throw new Error("derivation produced no key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  // Signing only: the relayer submits every transaction, so the user never needs MON.
  return { account: toViemAccount(session), end: () => session.end() };
}

export type Wallet = ReturnType<typeof accountFromPrf>;

export async function signUp(name: string): Promise<Wallet> {
  const { prfOutput } = await createPasskeyWithPrfOutput({
    rp: { id: rpId(), name: "Remit" },
    user: { name, displayName: name },
  });
  return accountFromPrf(prfOutput);
}

export async function signIn(): Promise<Wallet> {
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: rpId() });
  return accountFromPrf(prfOutput);
}
