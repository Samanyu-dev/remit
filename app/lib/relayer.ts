import "server-only";
import { createWalletClient, type ContractFunctionName, type ContractFunctionArgs, type Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, publicClient, transport } from "./config";

// One relayer key pays gas for every user action, so users never hold MON.
const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as `0x${string}`);
const wallet = createWalletClient({ account, chain, transport: transport() });

// ponytail: viem picks the nonce per call, so heavy concurrent use can collide; add a nonce queue if that shows up.
export async function relay<const A extends Abi, F extends ContractFunctionName<A, "nonpayable">>(p: {
  address: `0x${string}`;
  abi: A;
  functionName: F;
  args: ContractFunctionArgs<A, "nonpayable", F>;
}) {
  const { request } = await publicClient.simulateContract({ ...p, account } as never);
  const hash = await wallet.writeContract(request as never);
  return publicClient.waitForTransactionReceipt({ hash });
}

export const errorMessage = (e: unknown) => {
  const err = e as { shortMessage?: string; message?: string };
  return (err.shortMessage ?? err.message ?? "failed").split("\n")[0];
};
