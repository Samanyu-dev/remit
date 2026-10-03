// End-to-end check against testnet + local relayer, minus the passkey prompt:
// a throwaway sender mints, sends by link, and a fresh recipient claims via /api/claim.
// Usage: node --env-file=.env.local scripts/smoke.mjs [baseUrl]
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, parseEventLogs } from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { monadTestnet as chain } from "viem/chains";

const base = process.argv[2] ?? "http://localhost:3100";
const { NEXT_PUBLIC_TOKEN: TOKEN, NEXT_PUBLIC_ESCROW: ESCROW, NEXT_PUBLIC_RPC, RELAYER_PRIVATE_KEY } = process.env;
const transport = http(NEXT_PUBLIC_RPC);
const pub = createPublicClient({ chain, transport });
const abi = parseAbi([
  "function mint(address,uint256)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)",
  "function send(uint96,address,uint64) returns (uint256)", "function claimDigest(uint256,address) view returns (bytes32)",
  "event Sent(uint256 indexed id, address indexed sender, address indexed claimKey, uint256 amount, uint64 expiry)",
]);
const wallet = (pk) => createWalletClient({ account: privateKeyToAccount(pk), chain, transport });
const wait = async (p) => pub.waitForTransactionReceipt({ hash: await p });

const sender = wallet(generatePrivateKey());
await wait(wallet(RELAYER_PRIVATE_KEY).sendTransaction({ to: sender.account.address, value: parseEther("0.2") })); // gas money
// Monad executes a few blocks behind consensus, so a fresh balance can take a moment to be spendable.
while ((await pub.getBalance({ address: sender.account.address })) === 0n) await new Promise((r) => setTimeout(r, 500));
await new Promise((r) => setTimeout(r, 2000));
await wait(sender.writeContract({ address: TOKEN, abi, functionName: "mint", args: [sender.account.address, 50_000000n] }));
await wait(sender.writeContract({ address: TOKEN, abi, functionName: "approve", args: [ESCROW, 50_000000n] }));
const claimKey = generatePrivateKey();
const r = await wait(sender.writeContract({ address: ESCROW, abi, functionName: "send", args: [12_500000n, privateKeyToAddress(claimKey), BigInt(Math.floor(Date.now() / 1000) + 3600)] }));
const [{ args: { id } }] = parseEventLogs({ abi, eventName: "Sent", logs: r.logs });
console.log("sent link id", id);

const to = privateKeyToAddress(generatePrivateKey()); // brand-new recipient, zero MON
const sig = await privateKeyToAccount(claimKey).sign({ hash: await pub.readContract({ address: ESCROW, abi, functionName: "claimDigest", args: [id, to] }) });
const res = await fetch(`${base}/api/claim`, { method: "POST", body: JSON.stringify({ id: id.toString(), to, sig }) });
console.log("relayer", res.status, await res.json());
const bal = await pub.readContract({ address: TOKEN, abi, functionName: "balanceOf", args: [to] });
if (bal !== 12_500000n) throw new Error(`recipient balance ${bal}`);
const again = await fetch(`${base}/api/claim`, { method: "POST", body: JSON.stringify({ id: id.toString(), to, sig }) });
if (again.ok) throw new Error("double claim succeeded");
console.log("OK: recipient got $12.50 with zero gas; double claim rejected");
