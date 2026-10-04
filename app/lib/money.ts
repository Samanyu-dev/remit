import { formatUnits, parseUnits } from "viem";
import { DECIMALS } from "./config";

const num = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "1,590.00" */
export const fmtNum = (v: bigint) => num.format(Number(formatUnits(v, DECIMALS)));
/** "$1,590.00" */
export const fmt = (v: bigint) => `$${fmtNum(v)}`;
export const toUnits = (s: string) => parseUnits(s, DECIMALS);

// Claim links put the secret in the #fragment, which browsers never send to a server.
export const linkFor = (origin: string, id: bigint, key: `0x${string}`) => `${origin}/claim#${id}.${key}`;
export function parseLink(hash: string) {
  const [id, key] = hash.replace(/^#/, "").split(".");
  if (!/^\d+$/.test(id ?? "") || !/^0x[0-9a-fA-F]{64}$/.test(key ?? "")) return null;
  return { id: BigInt(id), key: key as `0x${string}` };
}
