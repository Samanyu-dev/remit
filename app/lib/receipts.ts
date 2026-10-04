// "One passkey, many keys": the same passkey PRF output that derives the wallet also derives,
// via HKDF with its own label, an AES-GCM key for receipts. One Face ID prompt unlocks both,
// and receipts stored on-chain can only be read by the passkey that wrote them.
import { bytesToHex, hexToBytes, type Hex } from "viem";

export type Receipt = { note: string; key: Hex }; // key = the link's claim secret, so links can be re-shared

export async function deriveReceiptsKey(prfOutput: Uint8Array): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey("raw", prfOutput as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("remit.v1.receipts") },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function sealReceipt(key: CryptoKey, r: Receipt): Promise<Hex> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(r)));
  return bytesToHex(new Uint8Array([...iv, ...new Uint8Array(ct)]));
}

/** Null when the memo isn't ours or was tampered with (AES-GCM authentication fails). */
export async function openReceipt(key: CryptoKey, memo: Hex): Promise<Receipt | null> {
  try {
    const b = hexToBytes(memo);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, key, b.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}
