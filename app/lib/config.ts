import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

export const chain = monadTestnet;
export const transport = () => http(process.env.NEXT_PUBLIC_RPC); // falls back to the chain default
export const publicClient = createPublicClient({ chain, transport: transport() });

export const TOKEN = process.env.NEXT_PUBLIC_TOKEN as `0x${string}`;
export const ESCROW = process.env.NEXT_PUBLIC_ESCROW as `0x${string}`;
export const DECIMALS = 6;

export const tokenAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)", // TestUSD only
]);

export const escrowAbi = parseAbi([
  "function send(uint96 amount, address claimKey, uint64 expiry) returns (uint256)",
  "function claim(uint256 id, address to, bytes sig)",
  "function refund(uint256 id)",
  "function links(uint256) view returns (address sender, address claimKey, uint96 amount, uint64 expiry)",
  "function claimDigest(uint256 id, address to) view returns (bytes32)",
  "event Sent(uint256 indexed id, address indexed sender, address indexed claimKey, uint256 amount, uint64 expiry)",
]);
