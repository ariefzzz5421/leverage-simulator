import test from "node:test";
import assert from "node:assert/strict";
import { isStablecoin, topNonStable } from "../lib/market.mjs";

test("stable-value assets are excluded without filtering unrelated $1 tokens", () => {
  assert.equal(
    isStablecoin({ id: "usd-coin", symbol: "USDC", name: "USDC" }),
    true,
  );
  assert.equal(
    isStablecoin({ id: "gho", symbol: "GHO", name: "Gho Token" }),
    true,
  );
  assert.equal(
    isStablecoin({ id: "stable", symbol: "STABLE", name: "Stable" }),
    false,
  );
  assert.equal(isStablecoin({ id: "xrp", symbol: "XRP", name: "XRP" }), false);
});

test("fills 100 non-stable assets from a wider ranked page and keeps original ranks", () => {
  const assets = Array.from({ length: 120 }, (_, i) => ({
    id: String(i),
    symbol: `C${i}`,
    name: `Coin ${i}`,
    rank: i + 1,
    price: i + 1,
  }));
  assets[2] = { ...assets[2], symbol: "USDT", name: "Tether USD" };
  assets[5] = { ...assets[5], symbol: "USDC", name: "USDC" };
  const result = topNonStable(assets);
  assert.equal(result.length, 100);
  assert.equal(result[0].rank, 1);
  assert.equal(result.at(-1).rank, 102);
  assert.ok(
    result.every((asset) => asset.symbol !== "USDT" && asset.symbol !== "USDC"),
  );
});
