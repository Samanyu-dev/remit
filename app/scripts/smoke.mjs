// End-to-end check against testnet + local relayer, minus the passkey prompt.
// Sender and recipient both start with zero MON: every transaction goes through the relayer.
// Usage: node --env-file=.env.local scripts/smoke.mjs [baseUrl]
import { createPublicClient, http, parseAbi } from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { monadTestnet as chain } from "viem/chains";

const base = process.argv[2] ?? "http://localhost:3100";
const { NEXT_PUBLIC_TOKEN: TOKEN, NEXT_PUBLIC_ESCROW: ESCROW, NEXT_PUBLIC_RPC } = process.env;
const pub = createPublicClient({ chain, transport: http(NEXT_PUBLIC_RPC) });
const abi = parseAbi([
  "function name() view returns (string)", "function balanceOf(address) view returns (uint256)",
  "function authNonce(address,uint64) view returns (bytes32)", "function claimDigest(uint256,address) view returns (bytes32)",
]);
const read = (address, functionName, args = []) => pub.readContract({ address, abi, functionName, args });
async function post(path, body) {
  const res = await fetch(base + path, { method: "POST", body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path}: ${json.error}`);
  return json;
}

const sender = privateKeyToAccount(generatePrivateKey());
await post("/api/faucet", { to: sender.address });
console.log("faucet ok, sender balance", await read(TOKEN, "balanceOf", [sender.address]));

const key = generatePrivateKey();
const claimKey = privateKeyToAddress(key);
const now = Math.floor(Date.now() / 1000);
const expiry = BigInt(now + 3600), validBefore = BigInt(now + 3600), value = 12_500000n;
const sig = await sender.signTypedData({
  domain: { name: await read(TOKEN, "name"), version: "1", chainId: chain.id, verifyingContract: TOKEN },
  types: { ReceiveWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
  ] },
  primaryType: "ReceiveWithAuthorization",
  message: { from: sender.address, to: ESCROW, value, validAfter: 0n, validBefore, nonce: await read(ESCROW, "authNonce", [claimKey, expiry]) },
});
const sendBody = { from: sender.address, claimKey, sig, amount: value.toString(), expiry: expiry.toString(), validBefore: validBefore.toString() };
const { id } = await post("/api/send", sendBody);
console.log("gasless send ok, link id", id);
await post("/api/send", sendBody).then(() => { throw new Error("replayed send succeeded"); }, () => console.log("replayed send rejected"));

const to = privateKeyToAddress(generatePrivateKey());
const claimSig = await privateKeyToAccount(key).sign({ hash: await read(ESCROW, "claimDigest", [BigInt(id), to]) });
await post("/api/claim", { id, to, sig: claimSig });
const bal = await read(TOKEN, "balanceOf", [to]);
if (bal !== value) throw new Error(`recipient balance ${bal}`);
await post("/api/claim", { id, to, sig: claimSig }).then(() => { throw new Error("double claim succeeded"); }, () => {});
if ((await pub.getBalance({ address: sender.address })) !== 0n) throw new Error("sender somehow has MON");
console.log("OK: $12.50 sent and claimed; sender and recipient never held MON; replay + double claim rejected");
