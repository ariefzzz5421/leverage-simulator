import { NextResponse } from "next/server";
import { topNonStable, type CatalogAsset } from "@/lib/market.mjs";

export const runtime = "nodejs";
type Catalog = {
  assets: CatalogAsset[];
  source: string;
  checkedAt: string;
  stale: boolean;
};
let cached: { until: number; catalog: Catalog } | null = null;
let pending: Promise<Catalog> | null = null;

async function requestJson(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Market API HTTP ${response.status}`);
  return response.json();
}

function safeIcon(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      [
        "cdn.coinranking.com",
        "coin-images.coingecko.com",
        "assets.coingecko.com",
      ].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function fromCoinGecko(key: string): Promise<Catalog> {
  const base =
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=150&page=1&sparkline=false";
  const headers = { "x-cg-demo-api-key": key };
  const [rows, stables] = await Promise.all([
    requestJson(base, headers) as Promise<Array<Record<string, unknown>>>,
    requestJson(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&category=stablecoins",
      headers,
    ) as Promise<Array<Record<string, unknown>>>,
  ]);
  if (!Array.isArray(rows) || !Array.isArray(stables))
    throw new Error("Invalid CoinGecko response");
  const stableIds = new Set(stables.map((row) => String(row.id)));
  const checkedAt = new Date().toISOString();
  const assets: CatalogAsset[] = rows.map((row) => ({
    id: String(row.id ?? ""),
    symbol: String(row.symbol ?? "").toUpperCase(),
    name: String(row.name ?? ""),
    rank: Number(row.market_cap_rank),
    image: safeIcon(row.image),
    color: "#294b43",
    price: Number(row.current_price),
    change24h:
      row.price_change_percentage_24h != null &&
      Number.isFinite(Number(row.price_change_percentage_24h))
        ? Number(row.price_change_percentage_24h)
        : null,
    asOf: typeof row.last_updated === "string" ? row.last_updated : checkedAt,
    source: "CoinGecko",
  }));
  const filtered = topNonStable(assets, stableIds);
  if (filtered.length < 100)
    throw new Error("CoinGecko returned fewer than 100 eligible assets");
  return { assets: filtered, source: "CoinGecko", checkedAt, stale: false };
}

async function fromCoinranking(): Promise<Catalog> {
  const key = process.env.COINRANKING_API_KEY?.trim();
  const headers: Record<string, string> = key ? { "x-access-token": key } : {};
  const [first, second] = (await Promise.all(
    [0, 100].map((offset) =>
      requestJson(
        `https://api.coinranking.com/v2/coins?limit=100&offset=${offset}&orderBy=marketCap&orderDirection=desc`,
        headers,
      ),
    ),
  )) as Array<{
    status?: string;
    data?: { coins?: Array<Record<string, unknown>> };
  }>;
  if (
    first.status !== "success" ||
    second.status !== "success" ||
    !first.data?.coins ||
    !second.data?.coins
  )
    throw new Error("Invalid Coinranking response");
  const checkedAt = new Date().toISOString();
  const assets: CatalogAsset[] = [
    ...first.data.coins,
    ...second.data.coins,
  ].map((row) => ({
    id: String(row.uuid ?? ""),
    symbol: String(row.symbol ?? "").toUpperCase(),
    name: String(row.name ?? ""),
    rank: Number(row.rank),
    image: safeIcon(row.iconUrl),
    color:
      typeof row.color === "string" && /^#[\da-f]{6}$/i.test(row.color)
        ? row.color
        : "#294b43",
    price: Number(row.price),
    change24h:
      row.change != null && Number.isFinite(Number(row.change))
        ? Number(row.change)
        : null,
    asOf: checkedAt,
    source: "Coinranking",
  }));
  const filtered = topNonStable(assets);
  if (filtered.length < 100)
    throw new Error("Coinranking returned fewer than 100 eligible assets");
  return { assets: filtered, source: "Coinranking", checkedAt, stale: false };
}

async function collect(): Promise<Catalog> {
  const key = process.env.COINGECKO_DEMO_API_KEY?.trim();
  if (key) {
    try {
      return await fromCoinGecko(key);
    } catch {
      /* Continue to Coinranking. */
    }
  }
  return fromCoinranking();
}

export async function GET() {
  if (cached && cached.until > Date.now())
    return NextResponse.json(cached.catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=120",
      },
    });
  pending ??= collect().finally(() => {
    pending = null;
  });
  try {
    const catalog = await pending;
    cached = { catalog, until: Date.now() + 20 * 60_000 };
    return NextResponse.json(catalog, {
      headers: {
        "Cache-Control": "public, s-maxage=1200, stale-while-revalidate=120",
      },
    });
  } catch {
    if (
      cached &&
      Date.now() - Date.parse(cached.catalog.checkedAt) < 60 * 60_000
    )
      return NextResponse.json(
        { ...cached.catalog, stale: true },
        { headers: { "Cache-Control": "public, s-maxage=30" } },
      );
    return NextResponse.json(
      {
        assets: [],
        source: "unavailable",
        checkedAt: new Date().toISOString(),
        stale: false,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
