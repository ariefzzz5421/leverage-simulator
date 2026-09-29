# Leverage Lab

Crypto leverage simulator with live market references and adjustable liquidation assumptions. The app never connects a wallet or places an order.

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. `npm.cmd test` checks the core math; `npm.cmd run build` checks the production bundle.

## Market data

`/api/assets` lists the top 100 eligible assets by market cap after filtering stablecoins. It uses CoinGecko `/coins/markets` when `COINGECKO_DEMO_API_KEY` is set, with Coinranking's public coin catalog as a fallback. Both provide asset identity, market rank, price, and official catalog icon URL. The catalog is cached for 20 minutes and explicitly labeled as a market snapshot. A Coinranking API key is optional; set `COINRANKING_API_KEY` server-side for higher limits. Never use a `NEXT_PUBLIC_` prefix for either key.

The six identity-matched assets BTC, ETH, SOL, XRP, DOGE, and ADA receive a fresh selected quote from Coinbase Exchange, then Kraken when available. The remaining assets retain their timestamped catalog price, avoiding ambiguous ticker-only matches across providers. Missing prices remain unavailable; there are no static or invented fallback prices. Selected quotes are cached for 20 seconds.

Public futures contract maxima are checked separately from OKX, Hyperliquid, Bybit, and Bitget. A failed contract request stays **Unverified**. Public maxima do not establish account eligibility or a given position tier.

## Liquidation estimate

The model assumes a linear USD-margined position. Notional is `margin × leverage`; quantity is `notional / entry`. Equity at a candidate mark price includes initial collateral, unrealized PnL, and opening fees. Estimated liquidation solves for equity equal to maintenance margin plus closing fees at that price. The default assumptions are 0.5% maintenance and 0.05% fee per side, both editable. Cross mode adds only the extra collateral explicitly entered by the user. Funding, other cross positions, exchange risk tiers, liquidation penalties, and differences between last trade and mark price are not modeled. The chart, table, and outputs label the result as an estimate.

The PnL path caps simulated loss at allocated collateral once a target price crosses the estimated liquidation level. The browser stores recent setups locally, and share links encode the inputs in the URL.

Drag the price path handle or use its keyboard-accessible slider to preview a target price. The entry and estimated liquidation levels stay marked as inputs change. Actual exchange liquidation and execution can differ from this simplified estimate.

## API routes

- `/api/prices` — supported spot reference prices with provider and timestamps.
- `/api/assets` — 100 non-stablecoin market-cap assets, logos, original ranks, prices, and snapshot metadata.
- `/api/quote?symbol=BTC` — fresh exchange quote for a known identity-matched asset.
- `/api/contracts?asset=BTC` — public futures contract maximum leverage when verifiable.
