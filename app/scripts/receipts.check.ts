// Run: node scripts/receipts.check.ts
import assert from "node:assert";
import { deriveReceiptsKey, openReceipt, sealReceipt } from "../lib/receipts.ts";

const prf = crypto.getRandomValues(new Uint8Array(32));
const key = await deriveReceiptsKey(prf);
const r = { note: "Rent for Oct 🏠", key: `0x${"ab".repeat(32)}` as const };
const memo = await sealReceipt(key, r);
assert.deepEqual(await openReceipt(key, memo), r);
assert.deepEqual(await openReceipt(await deriveReceiptsKey(prf), memo), r, "same passkey on another device opens it");
assert.equal(await openReceipt(await deriveReceiptsKey(crypto.getRandomValues(new Uint8Array(32))), memo), null, "other passkey can't");
assert.equal(await openReceipt(key, (memo.slice(0, -2) + (memo.endsWith("00") ? "01" : "00")) as `0x${string}`), null, "tamper detected");
assert.ok((memo.length - 2) / 2 <= 512, "fits contract memo cap");
console.log(`receipts ok (${(memo.length - 2) / 2} bytes)`);
