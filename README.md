# GIWA DeFi Suite

> GIWA built the trust layer. We built the first three reasons to trust someone.
>
> *GIWA가 신뢰 레이어(Dojang)를 만들었습니다. 우리는 그 신뢰를 '쓸 이유'를 처음 만들었습니다.*

An application for **GASOK 2026** — the first application layer on GIWA's **Dojang** attestation infrastructure. Three protocols, one shared trust source, deployed and verified on **GIWA Sepolia (OP Stack, chain 91342)**.

| Protocol | What it does | The part that's new |
|---|---|---|
| **DojangScore** | Reads 4 Dojang attestations → one on-chain trust score (0–1000, 4 tiers) | The credit bureau every other protocol gates on |
| **WonVault** | ERC-4626 KRW yield vault | Your trust tier sets your **entry fee** (2.00% → 0.50%) |
| **GIWASwap** | Constant-product AMM (Factory + Pool) | Verified wallets pay a **lower swap fee** (0.30% → 0.10%) |

**The moat:** every fee discount reads Dojang + the Upbit Korea attester — which exist *only* on GIWA. The suite is impossible to port to any other chain. Verify once; pay less and earn more everywhere. That loop is the product.

## On-chain evidence · GIWA Sepolia

| Contract | Address | Explorer |
|---|---|---|
| DojangScore | `0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f` | [view](https://sepolia-explorer.giwa.io/address/0xefE43F0258f9Ea8d05b2bf65D1A3d92afbB5d48f) |
| WonVault | `0xEE4E_PASTE_FULL_ADDRESS_FROM_deployed-addresses.json_69F5` | [view](https://sepolia-explorer.giwa.io/address/0xEE4E69F5) |
| GIWASwap Pool | `0x8813361aA6FFdC1B5926FA95d756b7390C680059` | [view](https://sepolia-explorer.giwa.io/address/0x8813361aA6FFdC1B5926FA95d756b7390C680059) |
| GIWASwap Factory | `0x7c7825AEF6b8b590dcF48d8C5059F3594B84a99F` | [view](https://sepolia-explorer.giwa.io/address/0x7c7825AEF6b8b590dcF48d8C5059F3594B84a99F) |
| TKRW / TUSD (test assets) | `0x11DF…4f40` / `0x84D9…9a80` | — |
| DojangScroll (upstream, not rebuilt) | `0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9` | [view](https://sepolia-explorer.giwa.io/address/0xd5077b67dcb56caC8b270C7788FC3E6ee03F17B9) |

Deployer: `0xE5EFB15259292F5B60A1DB074B708712998dB147`

## How trust becomes a discount

| DojangScore tier | Score | WonVault entry fee | GIWASwap fee |
|---|---|---|---|
| Standard (unverified) | 0–199 | 2.00% | 0.30% |
| Silver | 200–499 | 1.50% | 0.20% |
| Gold | 500–799 | 1.00% | 0.15% |
| Platinum | 800–1000 | 0.50% | 0.10% |

Verifying through Dojang literally keeps more of your money earning from day one — a direct economic incentive to complete verification, which is GIWA's own trust KPI.

## Security & honesty note

Our first WonVault build hit OpenZeppelin's **ERC-4626 inflation footgun** — with the inflation-protection switch off by default, a deposit minted *zero shares* and the share price spiked to `1.09e+21`. We did not catch it in a unit test. We caught it because we built a **live share-price readout that refuses to render a corrupted number** (it shows `—` / "degraded" instead of lying). We redeployed with the `_decimalsOffset()` mitigation (the Morpho / Euler v2 / OpenZeppelin recommendation) and delegated the share math back to the audited library path. The dashboard is not decoration — it is the instrument that caught a real bug before real money was at stake.

## Quick start

```bash
git clone https://github.com/thedivine1/giwa-defi-suite.git
cd giwa-defi-suite
npm install
cp .env.example .env        # paste your GIWA-Sepolia private key (testnet only)
npx hardhat compile
npx hardhat run scripts/deploy.js --network giwa
```

Testnet ETH for deployment gas: `https://faucet.giwa.io` (chain 91342).

## Companion documents (in `frontend/`)

- **`deck.html`** — the field dossier: per-protocol mechanics, monetization, track & criteria fit, security posture. Open in a browser or print to PDF.
- **`story.html`** — the build journal: the development & deployment story as longform (the 1e21, the toolchain comedy, the ethical question). Marketing-ready.
- **`index.html`** — the live demo app (connect wallet → score → vault → swap).

Host the `frontend/` folder (e.g. Vercel) so judges can click the demo and read both documents.

## Tracks & criteria

Argues **Track 01 (DeFi / RWA)**, **Track 03 (GIWA-Native)**, and **Track 05 (Mass Adoption)** at once — and answers all six selection criteria: chain fit, originality, feasibility, market demand, team execution, and wallet-embeddability.

## The builder

17+ years in industrial-automation **business development & go-to-market** (Rockwell · Siemens · Schneider Electric ecosystems), **in crypto since 2011**, with two products already shipped and in distribution — a patent-in-the-works user-intent engine ([loopnote.tech](https://loopnote.tech)) and a CBIC-sourced GST compliance API ([gstaccelerator.in](https://gstaccelerator.in)). This is the first on-chain build, shipped in 72 hours on one operating principle: *ship, get real feedback, improve, ship again.*

---

Built honest. Shipped on-chain. · GASOK 2026
