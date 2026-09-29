import { NextRequest, NextResponse } from "next/server";
import { ASSETS, type AssetSymbol } from "@/lib/assets";

export const runtime = "nodejs";
type Contract = {
  name: string;
  maxLeverage: number | null;
  contract: string;
  verifiedAt: string | null;
  source: string;
};
const names = [
  "Binance",
  "Bybit",
  "OKX",
  "Bitget",
  "Hyperliquid",
  "Kraken",
  "Coinbase",
] as const;
let cache = new Map<AssetSymbol, { until: number; contracts: Contract[] }>();

async function responseJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(4500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("asset");
  const asset = ASSETS.find((item) => item.symbol === symbol);
  if (!asset)
    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  const cached = cache.get(asset.symbol);
  if (cached && cached.until > Date.now())
    return NextResponse.json({ contracts: cached.contracts });
  const contracts: Contract[] = names.map((name) => ({
    name,
    maxLeverage: null,
    contract: `${asset.symbol} contract`,
    verifiedAt: null,
    source: "",
  }));
  const update = (
    name: string,
    max: unknown,
    contract: string,
    source: string,
  ) => {
    const value = Number(max);
    if (!Number.isFinite(value) || value < 1 || value > 1000) return;
    const target = contracts.find((item) => item.name === name);
    if (target)
      Object.assign(target, {
        maxLeverage: value,
        contract,
        verifiedAt: new Date().toISOString(),
        source,
      });
  };
  await Promise.all([
    (async () => {
      try {
        const instId = `${asset.symbol}-USDT-SWAP`;
        const data = (await responseJson(
          `https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${instId}`,
        )) as {
          data?: Array<{ instId: string; lever: string; state: string }>;
        };
        const row = data.data?.find(
          (item) => item.instId === instId && item.state === "live",
        );
        if (row)
          update(
            "OKX",
            row.lever,
            instId,
            "https://www.okx.com/docs-v5/en/#public-data-rest-api-get-instruments",
          );
      } catch {}
    })(),
    (async () => {
      try {
        const data = (await responseJson("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "meta" }),
        })) as { universe?: Array<{ name: string; maxLeverage: number }> };
        const row = data.universe?.find((item) => item.name === asset.symbol);
        if (row)
          update(
            "Hyperliquid",
            row.maxLeverage,
            asset.symbol,
            "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications",
          );
      } catch {}
    })(),
    (async () => {
      try {
        const pair = `${asset.symbol}USDT`;
        const data = (await responseJson(
          `https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES&symbol=${pair}`,
        )) as {
          data?: Array<{
            symbol: string;
            maxLever: string;
            symbolStatus: string;
          }>;
        };
        const row = data.data?.find(
          (item) => item.symbol === pair && item.symbolStatus === "normal",
        );
        if (row)
          update(
            "Bitget",
            row.maxLever,
            pair,
            "https://www.bitget.com/api-doc/contract/market/Get-All-Symbols-Contracts",
          );
      } catch {}
    })(),
    (async () => {
      try {
        const pair = `${asset.symbol}USDT`;
        const data = (await responseJson(
          `https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=${pair}`,
        )) as {
          result?: {
            list?: Array<{
              symbol: string;
              status: string;
              leverageFilter?: { maxLeverage: string };
            }>;
          };
        };
        const row = data.result?.list?.find(
          (item) => item.symbol === pair && item.status === "Trading",
        );
        if (row)
          update(
            "Bybit",
            row.leverageFilter?.maxLeverage,
            pair,
            "https://bybit-exchange.github.io/docs/v5/market/instrument",
          );
      } catch {}
    })(),
  ]);
  cache.set(asset.symbol, { until: Date.now() + 60_000, contracts });
  return NextResponse.json(
    { contracts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=30",
      },
    },
  );
}
