import { NextRequest, NextResponse } from "next/server";
import { ASSETS } from "@/lib/assets";

export const runtime = "nodejs";
type Quote = {
  price: number;
  source: "Coinbase" | "Kraken";
  asOf: string;
  change24h: null;
};
const cache = new Map<string, { until: number; quote: Quote }>();

async function getJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(4000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !ASSETS.some((item) => item.symbol === symbol))
    return NextResponse.json(
      { error: "Unsupported exchange quote symbol" },
      { status: 400 },
    );
  const found = cache.get(symbol);
  if (found && found.until > Date.now())
    return NextResponse.json(found.quote, {
      headers: { "Cache-Control": "public, s-maxage=20" },
    });
  let quote: Quote | null = null;
  try {
    const row = (await getJson(
      `https://api.exchange.coinbase.com/products/${symbol}-USD/ticker`,
    )) as { price?: string; time?: string };
    const price = Number(row.price);
    const age = Date.now() - Date.parse(row.time ?? "");
    if (
      Number.isFinite(price) &&
      price > 0 &&
      Number.isFinite(age) &&
      age > -60_000 &&
      age < 15 * 60_000
    )
      quote = {
        price,
        source: "Coinbase",
        asOf: String(row.time),
        change24h: null,
      };
  } catch {
    /* Check Kraken below. */
  }
  if (!quote) {
    try {
      const pair = symbol === "BTC" ? "XBT" : symbol;
      const data = (await getJson(
        `https://api.kraken.com/0/public/Ticker?pair=${pair}USD`,
      )) as { error?: string[]; result?: Record<string, { c?: string[] }> };
      if (!data.error?.length) {
        const price = Number(
          data.result && Object.values(data.result)[0]?.c?.[0],
        );
        if (Number.isFinite(price) && price > 0)
          quote = {
            price,
            source: "Kraken",
            asOf: new Date().toISOString(),
            change24h: null,
          };
      }
    } catch {
      /* The market catalog quote remains visible as a dated snapshot. */
    }
  }
  if (!quote)
    return NextResponse.json(
      { error: "No fresh exchange quote" },
      { status: 503, headers: { "Cache-Control": "public, s-maxage=20" } },
    );
  cache.set(symbol, { quote, until: Date.now() + 20_000 });
  return NextResponse.json(quote, {
    headers: { "Cache-Control": "public, s-maxage=20" },
  });
}
