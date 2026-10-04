# Remit

**Live (Monad testnet):** https://remit-bice.vercel.app — on a phone, open it and "Add to Home Screen" to install.

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
- **Receipts (one passkey, many keys):** the passkey's PRF output derives both the wallet key and, via HKDF (`remit.v1.receipts`), an AES-GCM key. Each send stores an encrypted receipt (note + link secret) in the `Sent` event, so only the sender's passkey can read it, on any device, and lost links can be re-shared.
- **History (Envio HyperSync):** Monad's RPC caps `eth_getLogs` at ~100 blocks, so `/api/history` reads the sender's `Sent` events via HyperSync. Needs `ENVIO_API_TOKEN`.
- **Claim:** the link's one-off key signs the recipient's address, so the relayer can't redirect it.

## Testnet deployment

| | Address |
|---|---|
| TestUSD (tAUSD) | `0x97d1F3040Cc0Aa3a43A1283435929aB29Fbe08cd` |
| RemitEscrow | `0xBb05006EE19f1Edc80a41a9015B217F380447cC7` |

RPC: `https://rpc-testnet.monadinfra.com` (the default `testnet-rpc.monad.xyz` timed out for us).
