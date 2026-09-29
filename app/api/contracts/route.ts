import { NextRequest, NextResponse } from "next/server";
import type { AssetSymbol } from "@/lib/assets";

export const runtime = "nodejs";
type Contract = {
  name: string;
  maxLeverage: number | null;
  contract: string;
  verifiedAt: string | null;
  source: string;
  status: "verified" | "not_listed" | "unavailable";
};
const names = [
  "Binance",
  "Bybit",
  "OKX",
  "Bitget",
  "Hyperliquid",
  "Kraken",
  "Coinbase",
  "MEXC",
] as const;
let cache = new Map<AssetSymbol, { until: number; contracts: Contract[] }>();
type MexcRow = { symbol: string; maxLeverage: number; state: number };
let mexcCache: { until: number; rows: MexcRow[] | null } | null = null;
let mexcPending: Promise<MexcRow[] | null> | null = null;

async function responseJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(4500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function mexcRows(): Promise<MexcRow[] | null> {
  if (mexcCache && mexcCache.until > Date.now()) return mexcCache.rows;
  mexcPending ??= (async () => {
    try {
      const payload = (await responseJson(
        "https://contract.mexc.com/api/v1/contract/detail",
      )) as { success?: boolean; code?: number; data?: MexcRow[] };
      if (
        payload.success !== true ||
        payload.code !== 0 ||
        !Array.isArray(payload.data)
      )
        throw new Error("Invalid MEXC contract response");
      mexcCache = { rows: payload.data, until: Date.now() + 5 * 60_000 };
      return payload.data;
    } catch {
      mexcCache = { rows: null, until: Date.now() + 30_000 };
      return null;
    } finally {
      mexcPending = null;
    }
  })();
  return mexcPending;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("asset");
  if (!symbol || !/^[A-Z0-9.-]{1,12}$/.test(symbol))
    return NextResponse.json({ error: "Unsupported asset" }, { status: 400 });
  const asset = { symbol };
  const cached = cache.get(symbol);
  if (cached && cached.until > Date.now())
    return NextResponse.json({ contracts: cached.contracts });
  const contracts: Contract[] = names.map((name) => ({
    name,
    maxLeverage: null,
    contract: `${asset.symbol} contract`,
    verifiedAt: null,
    source: "",
    status: "unavailable",
  }));
  const markMissing = (name: string, contract: string, source: string) => {
    const target = contracts.find((item) => item.name === name);
    if (target)
      Object.assign(target, { contract, source, status: "not_listed" });
  };
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
        status: "verified",
      });
  };
  await Promise.all([
    (async () => {
      try {
        const instId = `${asset.symbol}-USDT-SWAP`;
        const data = (await responseJson(
          `https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${instId}`,
        )) as {
          code?: string;
          data?: Array<{ instId: string; lever: string; state: string }>;
        };
        if (data.code !== "0" || !Array.isArray(data.data))
          throw new Error("Invalid OKX response");
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
        else
          markMissing(
            "OKX",
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
        if (!Array.isArray(data.universe))
          throw new Error("Invalid Hyperliquid response");
        const row = data.universe?.find((item) => item.name === asset.symbol);
        if (row)
          update(
            "Hyperliquid",
            row.maxLeverage,
            asset.symbol,
            "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications",
          );
        else
          markMissing(
            "Hyperliquid",
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
          code?: string;
          data?: Array<{
            symbol: string;
            maxLever: string;
            symbolStatus: string;
          }>;
        };
        if (data.code !== "00000" || !Array.isArray(data.data))
          throw new Error("Invalid Bitget response");
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
        else
          markMissing(
            "Bitget",
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
          retCode?: number;
          result?: {
            list?: Array<{
              symbol: string;
              status: string;
              leverageFilter?: { maxLeverage: string };
            }>;
          };
        };
        if (data.retCode !== 0 || !Array.isArray(data.result?.list))
          throw new Error("Invalid Bybit response");
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
        else
          markMissing(
            "Bybit",
            pair,
            "https://bybit-exchange.github.io/docs/v5/market/instrument",
          );
      } catch {}
    })(),
    (async () => {
      const rows = await mexcRows();
      if (!rows) return;
      const pair = `${asset.symbol}_USDT`;
      const source =
        "https://mexcdevelop.github.io/apidocs/contract_v1_en/#get-the-contract-information";
      const row = rows.find((item) => item.symbol === pair && item.state === 0);
      if (row) update("MEXC", row.maxLeverage, pair, source);
      else markMissing("MEXC", pair, source);
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
