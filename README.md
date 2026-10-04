# Remit

**Send dollars to anyone, as a link. They claim it with Face ID: no app, no seed phrase, no gas.**

Built on [Monad](https://monad.xyz) for the **[Metropolis hackathon](https://monad.xyz/developers/hackathons/metropolis)**, track **Consumer Products & Payments**.

- **Live app (Monad testnet):** https://remit-bice.vercel.app. On a phone, open it and tap *Add to Home Screen* to install it.
- **Docs:** [Product requirements](docs/PRD.md) · [Architecture](docs/ARCHITECTURE.md)

---

## The problem

Sending $50 home is still slow, expensive, and full of forms. Bank wires take days and cost $25 or more. Remittance apps charge 3 to 7% and make the recipient sign up, verify and link a bank first. Crypto rails settle in seconds for fractions of a cent, but they ask the recipient to install a wallet, write down 24 words and buy gas before they can receive anything.

The person receiving money shouldn't need anything except a phone.

## What Remit does

1. **Sign up with a passkey.** Face ID or a fingerprint creates a self-custodial dollar account in about 5 seconds. There is no password, no seed phrase and no browser extension. [Mera](https://mera.category.xyz) derives the account from the passkey.
2. **Send as a link.** Enter an amount and an optional note, then share the link over WhatsApp, SMS or anything else. The money sits in an escrow contract, not with us.
3. **Claim with one tap.** The recipient opens the link, creates a passkey and the dollars are theirs. They don't install an app or buy gas, and they never see the word "blockchain".
4. **Unclaimed money comes back.** The sender can reclaim a link after 7 days.

Every transaction is gasless for the user. A relayer pays the gas, and each action is authorized by a signature that the relayer can't alter.

## Why it's built on Monad

- **Instant settlement:** blocks are about 0.4 seconds, so "sent" and "received" feel like a chat message.
- **Fees too small to notice:** the relayer can cover gas for every user, so people only ever deal in dollars.
- **AUSD:** Agora's fully reserved dollar is native to Monad and supports EIP-3009 signed transfers. We checked the mainnet contract on-chain. That's what makes one-signature gasless sends possible.

## Sponsor integrations

| Bounty | How Remit uses it |
|---|---|
| **Agora: Best Cross-Border Payments App** | The product itself. AUSD sent across borders by link, Mera passkey onboarding, instant settlement, and a gasless EIP-3009 send (`receiveWithAuthorization`, which mainnet AUSD supports). |
| **Monad Foundation: Best Mera-Powered UX** | Mera is the entire account layer. Passkey to PRF to BIP-39/44 EOA, with no seed phrase, extension or custody backend. Sender and recipient both onboard with a single passkey prompt. |
| **Monad Foundation: Mera, One Passkey, Many Keys** | The same PRF output also derives, through HKDF with its own label, an AES-256-GCM **receipts key**. Every send stores an encrypted receipt (the note plus the link secret) in the on-chain `Sent` event. Only the sender's passkey can read their history, on any device, and lost links can be re-shared. |
| **Envio: Best Use of Envio** | Payment history (sent and received) comes from **HyperSync**. Monad's public RPC caps `eth_getLogs` at about 100 blocks, which is under a minute of history, so the indexer is what makes the transaction list possible. |

## Repository layout

```
contracts/          Foundry project
  src/RemitEscrow.sol   send / sendWithAuthorization / claim / refund
  src/TestUSD.sol       testnet stand-in for AUSD (6 decimals, EIP-3009)
  test/                 9 tests: claims, front-running, replay, refunds, gasless sends
  script/Deploy.s.sol
app/                Next.js 16 installable web app (PWA)
  app/page.tsx          wallet: balance, Send / Receive / Add, transactions
  app/claim/page.tsx    claim screen opened from a link
  app/api/              relayer endpoints: send, claim, faucet, history
  lib/wallet.ts         Mera passkey → account + receipts key
  lib/receipts.ts       AES-GCM receipt encryption
  lib/hypersync.ts      Envio HyperSync client
  scripts/smoke.mjs     end-to-end check against testnet
docs/               PRD and architecture
```

## Deployed contracts (Monad testnet, chain 10143)

| Contract | Address |
|---|---|
| RemitEscrow | [`0xBb05006EE19f1Edc80a41a9015B217F380447cC7`](https://testnet.monadvision.com/address/0xBb05006EE19f1Edc80a41a9015B217F380447cC7) |
| TestUSD (tAUSD) | [`0x97d1F3040Cc0Aa3a43A1283435929aB29Fbe08cd`](https://testnet.monadvision.com/address/0x97d1F3040Cc0Aa3a43A1283435929aB29Fbe08cd) |

On mainnet, the same escrow deploys against AUSD at `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (`TOKEN=<address> forge script ...`).

## Run it yourself

**Contracts**
```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge test
```

**Deploy to Monad testnet.** This needs a funded key in `contracts/.env`:
```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url https://rpc-testnet.monadinfra.com \
  --private-key $DEPLOYER_PRIVATE_KEY --broadcast --legacy
```
If `TOKEN` isn't set, the script also deploys `TestUSD`.

**App**
```bash
cd app
cp .env.example .env.local   # fill in the addresses, relayer key, Envio token
pnpm install
pnpm dev --port 3100
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_TOKEN`, `NEXT_PUBLIC_ESCROW` | Contract addresses |
| `NEXT_PUBLIC_RPC` | Monad RPC (we use `https://rpc-testnet.monadinfra.com`) |
| `RELAYER_PRIVATE_KEY` | Server-only key that pays gas. Needs MON. |
| `ENVIO_API_TOKEN`, `ESCROW_FROM_BLOCK` | HyperSync history |

**End-to-end check** (testnet, no passkey prompt needed):
```bash
cd app
node --env-file=.env.local scripts/smoke.mjs https://remit-bice.vercel.app
```
The script creates a sender with zero MON, gets test dollars, sends a gasless link, checks the history through HyperSync, and claims to a fresh recipient. It also confirms that replaying the send and claiming twice are both rejected.

Passkeys need HTTPS or `localhost`, and they're tied to the domain. An account made on `localhost` won't exist on the deployed URL.

## Security model, in short

- **Non-custodial.** User keys are derived on the device from the passkey and never leave it. Funds sit in the escrow contract, not with Remit.
- **The relayer can't redirect money.** Sends commit to the claim key and expiry inside the EIP-3009 nonce. Claims are signed by the link's one-time key over the recipient's address.
- **The link is the bearer secret.** It sits after `#` in the URL, which browsers never send to servers. Whoever opens it first can claim, so share it privately. The sender can reclaim unclaimed links after 7 days.

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Status

This is a hackathon build on Monad testnet. Built and working: passkey accounts, gasless send by link, claim, encrypted receipts and HyperSync history. Next: refunds through the relayer, deposits from any chain (Aurora Intents), and mainnet AUSD.
