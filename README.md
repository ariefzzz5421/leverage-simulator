# Leverage Lab

Crypto leverage simulator with live market references and adjustable liquidation assumptions. The app never connects a wallet or places an order.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. `npm.cmd test` checks the core math; `npm.cmd run build` checks the production bundle.

## Market data

The server calls CoinGecko `/coins/markets` first. For reliable CoinGecko Demo access, set `COINGECKO_DEMO_API_KEY` in `.env.local` and in the Vercel project environment. The key must remain server-side; never use a `NEXT_PUBLIC_` prefix. If CoinGecko is unavailable or a quote is stale, the server checks Coinbase Exchange ticker, then Kraken ticker. It publishes the provider and quote timestamp with every price. Missing prices remain unavailable; there are no static or invented fallback prices. Server quotes are cached for 25 seconds to reduce provider traffic.

Public futures contract maxima are checked separately from OKX, Hyperliquid, Bybit, and Bitget. A failed contract request stays **Unverified**. Public maxima do not establish account eligibility or a given position tier.

## Liquidation estimate

The model assumes a linear USD-margined position. Notional is `margin × leverage`; quantity is `notional / entry`. Equity at a candidate mark price includes initial collateral, unrealized PnL, and opening fees. Estimated liquidation solves for equity equal to maintenance margin plus closing fees at that price. The default assumptions are 0.5% maintenance and 0.05% fee per side, both editable. Cross mode adds only the extra collateral explicitly entered by the user. Funding, other cross positions, exchange risk tiers, liquidation penalties, and differences between last trade and mark price are not modeled. The chart, table, and outputs label the result as an estimate.

The PnL path caps simulated loss at allocated collateral once a target price crosses the estimated liquidation level. The browser stores recent setups locally, and share links encode the inputs in the URL.

## API routes

- `/api/prices` — supported spot reference prices with provider and timestamps.
- `/api/contracts?asset=BTC` — public futures contract maximum leverage when verifiable.
