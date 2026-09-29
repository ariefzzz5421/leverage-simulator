// Fiat-pegged and yield-bearing stable-value tokens commonly appearing near the top.
// Classification is by identity, never by a momentary price near $1.
const stableSymbols = new Set([
  "USDT",
  "USDC",
  "USDS",
  "USDE",
  "SUSDE",
  "DAI",
  "USD1",
  "USDG",
  "PYUSD",
  "USDY",
  "RLUSD",
  "USDD",
  "USDF",
  "TUSD",
  "FDUSD",
  "AUSD",
  "FRAX",
  "EURC",
  "EURCV",
  "EUR",
  "EURI",
  "EUROC",
  "GHO",
  "U",
  "LUSD",
  "BUSD",
  "USDP",
  "USDX",
  "USDB",
  "USDD",
  "USD0",
  "USD0++",
  "USDT0",
  "USDTB",
  "USDA",
  "CRVUSD",
  "DOLA",
  "MIM",
  "CUSD",
  "USDM",
  "SUSD",
  "EURS",
  "EURI",
  "USDT.E",
  "USDC.E",
  "USDT.W",
  "USDC.W",
  "YUSD",
  "USDF",
  "SDAI",
]);

export function isStablecoin(asset, stableIds = new Set()) {
  if (stableIds.has(asset.id)) return true;
  const symbol = String(asset.symbol || "").toUpperCase();
  const name = String(asset.name || "").toLowerCase();
  if (stableSymbols.has(symbol)) return true;
  if (/^(?:USD|EUR)[A-Z0-9.+-]{1,8}$/.test(symbol)) return true;
  return /\b(?:stablecoin|stable coin|usd stable|us dollar|dollar stable|euro stable|digital dollar|synthetic dollar)\b/.test(
    name,
  );
}

export function topNonStable(assets, stableIds = new Set(), count = 100) {
  const seen = new Set();
  return [...assets]
    .filter(
      (asset) =>
        Number.isInteger(asset.rank) &&
        asset.rank > 0 &&
        Number.isFinite(asset.price) &&
        asset.price > 0 &&
        !isStablecoin(asset, stableIds),
    )
    .sort((a, b) => a.rank - b.rank)
    .filter((asset) => {
      const symbol = String(asset.symbol).toUpperCase();
      if (seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    })
    .slice(0, count);
}
