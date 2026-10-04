# Remit

Send dollars (AUSD) across borders as a link. Recipient claims with a passkey (Mera). Built on Monad for the Metropolis hackathon.

## Contracts

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge test
```

## Deploy (Monad testnet)

```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url $MONAD_TESTNET_RPC --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```
Without `TOKEN` set this also deploys `TestUSD` (open-mint test AUSD). Put the printed addresses in `app/.env.local` (see `app/.env.example`).

## App

```bash
cd app
pnpm install
pnpm dev
```
Smoke test (testnet + local relayer, no passkey prompt): `node --env-file=.env.local scripts/smoke.mjs` with `pnpm dev --port 3100` running.

Passkeys need HTTPS or `localhost`. The relayer key in `RELAYER_PRIVATE_KEY` pays gas for everything (faucet, send, claim), so it needs testnet MON. Users never hold MON:

- **Send:** the sender signs an EIP-3009 `ReceiveWithAuthorization` (supported by mainnet AUSD). Its nonce is `keccak256(escrow, claimKey, expiry)`, so the relayer can't change where the money goes.
- **Claim:** the link's one-off key signs the recipient's address, so the relayer can't redirect it.

## Testnet deployment

| | Address |
|---|---|
| TestUSD (tAUSD) | `0xBc77A66Ca36eF02a3Ad1ad4049Cb4c52388810D5` |
| RemitEscrow | `0x4b308d968495971525CaFe27488B82a85ad26967` |

RPC: `https://rpc-testnet.monadinfra.com` (the default `testnet-rpc.monad.xyz` timed out for us).
