# Remit: product requirements

**One line:** Send dollars to anyone as a link. They claim it with Face ID, with no app, seed phrase or gas fees, settled instantly in AUSD on Monad.

**Hackathon:** Monad Metropolis (Sept 1 to Oct 13, 2026). Primary track: **Consumer Products & Payments**.

## 1. Problem

Sending small amounts across borders is still slow, expensive and full of friction, especially for the person receiving the money.

| Option today | Cost | Speed | What the recipient must do |
|---|---|---|---|
| Bank wire | $25–50 plus FX markup | 1–5 days | Have a bank account, and share account and SWIFT details |
| Remittance apps | 3–7% | Minutes to days | Download the app, sign up, complete KYC, link a bank |
| Crypto wallets | Under $0.01 | Seconds | Install a wallet, save 24 words, buy gas, share a 42-character address |

Crypto rails fix cost and speed, but they make onboarding worse. The recipient, who often isn't technical and is often on a cheap phone, is asked to do the most work.

## 2. Users

- **Sender, for example Priya in Dubai:** sends $50–300 home every month to her parents in Kerala. She cares about fees, speed, and knowing the money arrived.
- **Recipient, for example Priya's mother:** uses WhatsApp on an Android phone. She has never used crypto and never will by that name. She will tap a link and use her fingerprint.
- **Friends splitting costs:** someone paying back a friend abroad for a shared trip.

## 3. Goals and non-goals

**Goals**
1. A recipient goes from link to dollars in under 30 seconds, with zero setup beyond a passkey.
2. Neither user ever needs or sees a gas token, a seed phrase or a wallet address.
3. Funds are self-custodial at every step. Remit never holds user money or keys.
4. A sender's history and notes follow them to any device and stay private.

**Non-goals for the hackathon**
- Cashing out to local currency or a bank account. AUSD is the unit of value, and off-ramp partners would come later.
- KYC and compliance flows.
- A native App Store binary. We ship an installable web app, and an Expo wrapper is planned if needed.

## 4. User stories and requirements

### Onboarding
| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| O1 | As a new user, I create an account with Face ID or a fingerprint. | One passkey prompt creates the account. No password, seed phrase or extension. | Done |
| O2 | As a returning user, I sign in on any device with my synced passkey. | The same address and the same history appear on the new device. | Done |
| O3 | If I tap "I already have an account" on a device with no passkey, I'm told what to do. | A clear message points me to creating an account. | Done |

### Sending
| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| S1 | As a sender, I enter an amount and get a shareable link. | One signature, no gas, link ready in about 2 seconds. | Done |
| S2 | I can add a private note ("Rent for Oct"). | The note is encrypted on-chain and readable only with my passkey. | Done |
| S3 | I can't send more than my balance. | The button is disabled and an inline warning appears. | Done |
| S4 | I share via the phone's share sheet, or copy the link. | Native share works, and cancelling the sheet causes no error. | Done |
| S5 | If I lose a link before it's claimed, I can get it back. | History shows **Copy link** for unclaimed items on any device. | Done |
| S6 | If nobody claims within 7 days, I get my money back. | The contract supports refunds. The in-app gasless refund is still to do. | Partial |

### Receiving
| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| R1 | As a recipient, I open the link and see how much I've been sent. | The amount shows before any sign-up. | Done |
| R2 | I claim with a passkey and never pay gas. | The relayer submits the claim, and the recipient holds no MON. | Done |
| R3 | A used or invalid link tells me so. | A clear message, and a way into the app. | Done |
| R4 | Money I've received shows in my history. | Green "Money received" entries with time and amount. | Done |

### Wallet
| ID | Story | Acceptance criteria | Status |
|---|---|---|---|
| W1 | I see my dollar balance at a glance. | The balance card shows US$ to 2 decimals and can be refreshed. | Done |
| W2 | I see my sent and received history. | Pulled from Envio HyperSync, newest first, with status. | Done |
| W3 | I can add money. | Testnet: free test dollars. Planned: deposit from any chain through Aurora Intents. | Partial |
| W4 | It feels like an app. | Installable to the home screen, full-screen, safe-area aware, works one-handed. | Done |

## 5. Security and trust requirements

- User keys are derived on the device from the passkey and never stored or sent anywhere.
- The relayer can delay a transaction but can't change its amount, recipient or claim key. The contract and its tests enforce this.
- The link secret lives only in the URL fragment, which servers never receive.
- A claim is bound to the recipient's address, so watching the mempool can't redirect it.
- Receipts are protected with AES-GCM, so tampering is detected and an altered receipt shows with no note rather than a wrong one.

## 6. Success metrics (for the demo and the pilot)

- **Time to claim:** under 30 seconds from opening the link to having funds, for a first-time user.
- **Gas tokens held by users:** 0 MON. Confirmed by `scripts/smoke.mjs`, which asserts the sender's MON balance is still zero after the full flow.
- **Cost per transfer:** the relayer's gas on Monad, a fraction of a cent, compared with 3–7% for remittance apps.
- **Prompts:** one passkey prompt to sign up or sign in; sends and claims add no extra steps.

## 7. Roadmap

| Phase | Items |
|---|---|
| Hackathon (by Oct 13) | Gasless refunds through the relayer. Any-chain deposits with Aurora Intents. Demo polish. Optional Expo wrapper. |
| Pilot | Mainnet AUSD. Relayer rate limits and nonce queue. A small flat fee in AUSD to cover gas. Contacts saved as encrypted receipts. |
| Later | Local off-ramps. Payment requests ("Receive" generates a request link). Recurring sends. Group pots. |

## 8. Risks

| Risk | Mitigation |
|---|---|
| Passkey PRF support varies by passkey manager | Detect `PRF_UNAVAILABLE` and recommend iCloud Keychain or Google Password Manager. |
| Bearer links can be forwarded or intercepted | Advise private sharing. The sender can reclaim after expiry. Optional PIN-protected links are planned. |
| The relayer is a single point of failure | Funds are never at risk because the relayer can't move them. Anyone can call `claim`, so a fallback relayer or self-submission works. |
| Monad testnet RPC limits | Configurable RPC, and HyperSync for history. |
