import { NextResponse } from "next/server";
import { ASSETS, type AssetSymbol } from "@/lib/assets";

export const runtime = "nodejs";

type Quote = {
  price: number;
  source: "CoinGecko" | "Coinbase" | "Kraken";
  asOf: string;
  change24h: number | null;
};
type Payload = {
  prices: Partial<Record<AssetSymbol, Quote>>;
  checkedAt: string;
  unavailable: AssetSymbol[];
};
let cache: { until: number; data: Payload } | null = null;

async function jsonFrom(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...headers },
    signal: AbortSignal.timeout(4500),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
  return response.json();
}

function validPrice(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function fresh(timestamp: unknown) {
  if (typeof timestamp !== "string") return false;
  const age = Date.now() - Date.parse(timestamp);
  return Number.isFinite(age) && age > -60_000 && age < 15 * 60_000;
}

async function collect(): Promise<Payload> {
  const prices: Payload["prices"] = {};
  const key = process.env.COINGECKO_DEMO_API_KEY?.trim();
  const url = new URL("/api/v3/coins/markets", "https://api.coingecko.com");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("ids", ASSETS.map((asset) => asset.id).join(","));
  url.searchParams.set("price_change_percentage", "24h");
  url.searchParams.set("per_page", String(ASSETS.length));
  try {
    const rows = (await jsonFrom(
      url.toString(),
      key ? { "x-cg-demo-api-key": key } : {},
    )) as Array<Record<string, unknown>>;
    if (!Array.isArray(rows)) throw new Error("Invalid CoinGecko payload");
    for (const asset of ASSETS) {
      const row = rows.find((candidate) => candidate.id === asset.id);
      const price = validPrice(row?.current_price);
      if (price && fresh(row?.last_updated))
        prices[asset.symbol] = {
          price,
          source: "CoinGecko",
          asOf:
            typeof row?.last_updated === "string"
              ? row.last_updated
              : new Date().toISOString(),
          change24h: Number.isFinite(Number(row?.price_change_percentage_24h))
            ? Number(row?.price_change_percentage_24h)
            : null,
        };
    }
  } catch {
    /* Try independent market sources below. */
  }

  await Promise.all(
    ASSETS.filter((asset) => !prices[asset.symbol]).map(async (asset) => {
      try {
        const ticker = (await jsonFrom(
          `https://api.exchange.coinbase.com/products/${asset.coinbase}/ticker`,
        )) as Record<string, unknown>;
        const price = validPrice(ticker.price);
        if (price && fresh(ticker.time))
          prices[asset.symbol] = {
            price,
            source: "Coinbase",
            asOf: String(ticker.time),
            change24h: null,
          };
      } catch {
        /* Kraken remains available. */
      }
    }),
  );

  await Promise.all(
    ASSETS.filter((asset) => !prices[asset.symbol]).map(async (asset) => {
      try {
        const data = (await jsonFrom(
          `https://api.kraken.com/0/public/Ticker?pair=${asset.kraken}`,
        )) as { error?: string[]; result?: Record<string, { c?: string[] }> };
        if (data.error?.length) return;
        const ticker = data.result && Object.values(data.result)[0];
        const price = validPrice(ticker?.c?.[0]);
        if (price)
          prices[asset.symbol] = {
            price,
            source: "Kraken",
            asOf: new Date().toISOString(),
            change24h: null,
          };
      } catch {
        /* Report this symbol unavailable. */
      }
    }),
  );

  return {
    prices,
    checkedAt: new Date().toISOString(),
    unavailable: ASSETS.filter((asset) => !prices[asset.symbol]).map(
      (asset) => asset.symbol,
    ),
  };
}

export async function GET() {
  if (cache && cache.until > Date.now())
    return NextResponse.json(cache.data, {
      headers: {
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=15",
      },
    });
  const data = await collect();
  if (Object.keys(data.prices).length)
    cache = { data, until: Date.now() + 25_000 };
  return NextResponse.json(data, {
    status: Object.keys(data.prices).length ? 200 : 503,
    headers: {
      "Cache-Control": "public, s-maxage=20, stale-while-revalidate=15",
    },
  });
}
