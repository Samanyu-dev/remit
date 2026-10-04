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
import { deriveReceiptsKey } from "./receipts";

// Passkeys are bound to the domain, so the same passkey works on every page of this site.
const rpId = () => window.location.hostname;

async function accountFromPrf(prfOutput: Uint8Array) {
  const seed = mnemonicToSeedSync(entropyToMnemonic(prfOutput, wordlist));
  const node = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0");
  if (!node.privateKey) throw new Error("derivation produced no key");
  const session = createSecp256k1SigningSession({ privateKey: node.privateKey });
  // Signing only: the relayer submits every transaction, so the user never needs MON.
  return { account: toViemAccount(session), receiptsKey: await deriveReceiptsKey(prfOutput), end: () => session.end() };
}

export type Wallet = Awaited<ReturnType<typeof accountFromPrf>>;

// Mera doesn't expose WebAuthn authenticator hints, so while it runs we add them to its
// navigator.credentials calls: prefer this device's own passkey (Face ID / Touch ID, synced via
// iCloud Keychain or Google Password Manager) over the "scan a QR code / use a security key" picker.
async function onThisDevice<T>(f: () => Promise<T>): Promise<T> {
  const c = navigator.credentials;
  const { create, get } = c;
  type Opts = CredentialCreationOptions & CredentialRequestOptions;
  const hinted = (o?: Opts, attach = false) =>
    o?.publicKey
      ? ({
          ...o,
          publicKey: {
            ...o.publicKey,
            hints: ["client-device"],
            ...(attach && {
              authenticatorSelection: { ...(o.publicKey as PublicKeyCredentialCreationOptions).authenticatorSelection, authenticatorAttachment: "platform" },
            }),
          },
        } as Opts)
      : o;
  c.create = (o) => create.call(c, hinted(o as Opts, true));
  c.get = (o) => get.call(c, hinted(o as Opts));
  try {
    return await f();
  } finally {
    c.create = create;
    c.get = get;
  }
}

export async function signUp(name: string): Promise<Wallet> {
  const { prfOutput } = await onThisDevice(() => createPasskeyWithPrfOutput({
    rp: { id: rpId(), name: "Remit" },
    user: { name, displayName: name },
  }));
  return accountFromPrf(prfOutput);
}

export async function signIn(): Promise<Wallet> {
  const { prfOutput } = await onThisDevice(() => getPasskeyPrfOutput({ rpId: rpId() }));
  return accountFromPrf(prfOutput);
}
