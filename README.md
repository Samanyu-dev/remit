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
Passkeys need HTTPS or `localhost`. The relayer key in `RELAYER_PRIVATE_KEY` pays gas for claims, so it needs testnet MON.
