# 🏪 Mirror Marketplace

**Built by [@yksanjo](https://github.com/yksanjo)**

A system where your wallet, activity log, and marketplace experience all merge into a single real-time ecosystem connecting **identity, transactions, memory, and opportunities**.

Mirror Marketplace lets you subscribe to top Solana traders' AI-generated trade theses. Patreon + OnlyFans + Substack for on-chain trading alpha. Performance-verified, on-chain transparent.

## The Vision

Most alpha is:
- Locked in private Telegram groups (no verification)
- Sold by anonymous "gurus" (no track record)
- Lost in Discord threads (no structure)

Mirror Marketplace fixes this. Every trader's **performance is on-chain verified**. Every thesis is **AI-generated and timestamped**. Every subscription is **paid in SOL, auto-renewing**. Identity, reputation, and opportunity — connected.

## Features

- Browse verified traders with real performance stats
- Subscribe to different tiers (Basic / Premium / Whale)
- Get real-time AI-generated trade theses
- Performance-verified — no fake gurus
- Platform takes 5% fee (configurable via `PLATFORM_FEE_BPS`)
- **On-chain payment verification** — every paid subscription is validated against a real Solana transaction before being recorded

## Quick Start

```bash
npm install
cp .env.example .env.local   # fill in PLATFORM_FEE_WALLET + SOLANA_RPC_URL
npm run dev
```

## Environment

| Var | Required | Purpose |
|---|---|---|
| `SOLANA_RPC_URL` | recommended | RPC used to fetch subscription payment txs (default: public mainnet) |
| `PLATFORM_FEE_WALLET` | **required for paid tiers** | Wallet that receives platform fee |
| `PLATFORM_FEE_BPS` | optional | Basis points; default `500` (5%) |
| `MARKETPLACE_DATA_DIR` | optional | Local JSON state dir (when KV unset) |
| `KV_REST_API_URL` | required on Vercel | Vercel KV / Upstash Redis URL — autoset by Vercel KV integration |
| `KV_REST_API_TOKEN` | required on Vercel | Vercel KV / Upstash Redis token — autoset by Vercel KV integration |
| `DEPLOYER_API_URL` | optional | mirror-deployer URL for cross-linking |

## Persistence

The app stores listings, subscriptions, and used payment signatures via a
small abstraction in `src/lib/db.ts`:

- **Production (Vercel)** — uses Vercel KV (Upstash Redis under the hood) when
  `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set. Stores:
  - `marketplace:listings` (Redis Hash keyed by listing id)
  - `marketplace:subs` (Redis Hash keyed by subscriberWallet)
  - `marketplace:used_sigs` (Redis Set of payment signatures)
- **Local dev** — if KV creds are not set, falls back to JSON files in
  `MARKETPLACE_DATA_DIR` (default `./data`). The same code path runs in both
  modes; only the storage backend differs.

## API

### `GET /api/listings`
Returns all listings (sorted by followers desc), enriched with mirror-deployer reputation when available.

### `POST /api/listings` — add a listing
Listings require a wallet-ownership proof so people can't list wallets they don't control.

```json
{
  "id": "mirror_<your_id>",
  "wallet": "<your-solana-pubkey>",
  "username": "@you",
  "bio": "...",
  "verified": false,
  "tiers": [{ "tier": "basic", "priceSol": 0.1, "benefits": ["..."] }],
  "stats": { "totalTrades": 0, "winRate": 0, "followers": 0 },
  "totalVolumeSol": 0,
  "createdAt": 1715000000000,
  "proof": {
    "wallet": "<your-solana-pubkey>",
    "message": "mirror-marketplace::list::<your-solana-pubkey>::<unix_seconds>",
    "signature": "<base58 ed25519 sig of `message` by `wallet`>"
  }
}
```

Sign with any Solana wallet adapter via `signMessage(encode(message))`. The proof is valid for 5 minutes.

### `POST /api/subscribe` — subscribe to a trader
Paid tiers require a `paymentSignature` referencing a confirmed Solana transaction that includes:
- a `SystemProgram.transfer` from `subscriberWallet` → `creatorWallet` for `priceSol * (1 - feeBps/10000)`
- a `SystemProgram.transfer` from `subscriberWallet` → `PLATFORM_FEE_WALLET` for `priceSol * feeBps/10000`

```json
{
  "subscriberWallet": "<buyer>",
  "creatorWallet": "<trader>",
  "tier": "premium",
  "paymentSignature": "<base58 tx signature>"
}
```

The signature is verified, anti-replay checked, and must be confirmed within the last 10 minutes. Free tiers (`priceSol: 0`) skip the payment step.

## Deploy

```bash
npm run build
npm start
```

## Frontend

The Subscribe button is fully wired:
1. User clicks **Select Wallet** (top-right) and connects Phantom
2. Click **Subscribe** on any paid tier
3. Wallet pops up to sign a single Solana tx with two SystemProgram transfers (creator + fee)
4. Frontend waits for `confirmed` commitment, then POSTs the signature to `/api/subscribe`
5. Server re-verifies on-chain, anti-replays, and records the subscription

Free tiers skip the on-chain step entirely.

## Roadmap

- Add a "List your wallet" form on the frontend that signs the listing-proof message
- SPL token payment support (currently SOL only)
- Webhook notifications on subscribe (Discord/Telegram)

---

*Built by [@yksanjo](https://github.com/yksanjo)*
