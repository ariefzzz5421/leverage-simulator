"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ASSETS, type AssetSymbol } from "@/lib/assets";
import { AssetIcon, AssetPicker } from "@/components/AssetPicker";
import type { CatalogAsset } from "@/lib/market.mjs";
import { simulate } from "@/lib/math.mjs";

type Side = "long" | "short";
type Mode = "isolated" | "cross";
type Quote = {
  price: number;
  source: string;
  asOf: string;
  change24h: number | null;
  snapshot?: boolean;
};
type Contract = {
  name: string;
  maxLeverage: number | null;
  contract: string;
  verifiedAt: string | null;
  source: string;
};
type Saved = {
  id: number;
  asset: AssetSymbol;
  side: Side;
  mode: Mode;
  entry: number;
  margin: number;
  leverage: number;
  exit: number;
  extraCollateral: number;
  maintenanceRate: number;
  feeRate: number;
};
const storageKey = "leverage-lab-simulations-v1";
const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const usd = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
const signedUsd = (value: number) =>
  `${value >= 0 ? "+" : "−"}${usd(Math.abs(value), 2)}`;
const signedPct = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
const fmtPrice = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const digits =
    value >= 100
      ? 0
      : value >= 1
        ? 2
        : Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(value))));
  return usd(value, digits);
};
const parseNumber = (value: string) =>
  Number(value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"));

function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 48 48">
          <path d="M10 34V11h7v17h10v6H10Z" fill="currentColor" />
          <path
            d="m24 25 7-8 5 5 5-9"
            fill="none"
            stroke="#41e7b0"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="brand-type">
        LEVERAGE<span>LAB</span>
      </span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  decimals = 2,
  prefix = "$",
  hint,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  decimals?: number;
  prefix?: string;
  hint?: string;
  min?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft ??
    (value > 0
      ? new Intl.NumberFormat("en-US", {
          maximumFractionDigits: decimals,
        }).format(value)
      : "");
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-box">
        <span className="field-prefix">{prefix}</span>
        <input
          aria-label={label}
          inputMode="decimal"
          type="text"
          value={display}
          placeholder="0"
          onFocus={() => setDraft(display)}
          onChange={(event) => {
            const raw = event.target.value;
            const clean = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
            const parts = clean.split(".");
            const formatted = parts[0]
              ? Number(parts[0]).toLocaleString("en-US")
              : "";
            const next =
              formatted +
              (parts.length > 1 ? `.${parts[1].slice(0, decimals)}` : "");
            setDraft(next);
            const number = parseNumber(clean);
            onChange(Number.isFinite(number) ? Math.max(min, number) : 0);
          }}
          onBlur={() => setDraft(null)}
        />
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}

function Chart({
  entry,
  exit,
  liquidation,
  margin,
  leverage,
  side,
  mode,
  extraCollateral,
  maintenanceRate,
  feeRate,
  onExit,
}: {
  entry: number;
  exit: number;
  liquidation: number | null;
  margin: number;
  leverage: number;
  side: Side;
  mode: Mode;
  extraCollateral: number;
  maintenanceRate: number;
  feeRate: number;
  onExit: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const spread =
    entry > 0
      ? Math.min(
          0.75,
          Math.max(
            0.04,
            Math.abs(exit / entry - 1) * 1.25,
            liquidation ? Math.abs(liquidation / entry - 1) * 2.3 : 0,
          ),
        )
      : 0.05;
  const low = Math.max(0.00000001, entry * (1 - spread));
  const high = entry * (1 + spread);
  const x = (price: number) => 46 + ((price - low) / (high - low)) * 688;
  const points = useMemo(
    () =>
      Array.from({ length: 141 }, (_, i) => {
        const price = low + ((high - low) * i) / 140;
        const value =
          simulate({
            entry,
            margin,
            leverage,
            side,
            exit: price,
            mode,
            extraCollateral,
            maintenanceRate,
            feeRate,
          })?.netPnl ?? 0;
        return { price, value };
      }),
    [
      low,
      high,
      entry,
      margin,
      leverage,
      side,
      mode,
      extraCollateral,
      maintenanceRate,
      feeRate,
    ],
  );
  const bound = Math.max(
    margin + extraCollateral,
    ...points.map((point) => Math.abs(point.value)),
    1,
  );
  const y = (value: number) => 141 - (value / bound) * 96;
  const path = points
    .map(
      (point, i) =>
        `${i ? "L" : "M"}${x(point.price).toFixed(2)} ${y(point.value).toFixed(2)}`,
    )
    .join(" ");
  const shown = hover ?? exit;
  const result = simulate({
    entry,
    margin,
    leverage,
    side,
    exit: shown,
    mode,
    extraCollateral,
    maintenanceRate,
    feeRate,
  });
  const position = Math.min(734, Math.max(46, x(shown)));
  const sliderPct = ((exit - low) / (high - low)) * 100;
  const entryPct = ((entry - low) / (high - low)) * 100;
  const liquidationPct = liquidation
    ? ((liquidation - low) / (high - low)) * 100
    : null;
  return (
    <Card className="chart-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">INTERACTIVE RISK MAP</span>
          <h2>Where the trade breaks</h2>
          <p>Move across the chart or drag the price slider to test an exit.</p>
        </div>
        <span className="estimate-tag">ESTIMATE · NOT AN EXCHANGE QUOTE</span>
      </div>
      {entry > 0 ? (
        <>
          <div className="chart-wrap">
            <svg
              className="risk-chart"
              viewBox="0 0 780 290"
              role="img"
              aria-label="Interactive net profit and loss against asset price"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#40dba7" stopOpacity=".16" />
                  <stop offset="1" stopColor="#40dba7" stopOpacity="0" />
                </linearGradient>
              </defs>
              <rect
                x="46"
                y="25"
                width="688"
                height="218"
                rx="8"
                fill="#0b1214"
              />
              <path
                d={`M46 ${y(0)}H734`}
                stroke="#5d7072"
                strokeDasharray="5 7"
              />
              <path
                d={path}
                fill="none"
                stroke="#40dba7"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {liquidation && liquidation >= low && liquidation <= high && (
                <g>
                  <path
                    d={`M${x(liquidation)} 26V244`}
                    stroke="#ff6e79"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={x(liquidation)}
                    y="20"
                    textAnchor="middle"
                    fill="#ff8b93"
                    fontSize="11"
                  >
                    LIQUIDATION
                  </text>
                </g>
              )}
              <path
                d={`M${x(entry)} 26V244`}
                stroke="#dbe7e3"
                strokeWidth="1.5"
                strokeDasharray="3 6"
              />
              <circle
                cx={position}
                cy={y(result?.netPnl ?? 0)}
                r="6"
                fill={result && result.netPnl < 0 ? "#ff6e79" : "#40dba7"}
                stroke="#0b1214"
                strokeWidth="3"
              />
              <path d={`M${position} 26V244`} stroke="#cde0d8" opacity=".35" />
              <text x="46" y="267" fill="#8d9a9e" fontSize="12">
                {fmtPrice(low)}
              </text>
              <text
                x={x(entry)}
                y="267"
                textAnchor="middle"
                fill="#dfeae5"
                fontSize="12"
              >
                ENTRY {fmtPrice(entry)}
              </text>
              <text
                x="734"
                y="267"
                textAnchor="end"
                fill="#8d9a9e"
                fontSize="12"
              >
                {fmtPrice(high)}
              </text>
              <rect
                x="46"
                y="25"
                width="688"
                height="218"
                fill="transparent"
                onPointerMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const relative = Math.min(
                    1,
                    Math.max(0, (event.clientX - rect.left) / rect.width),
                  );
                  setHover(low + relative * (high - low));
                }}
                onPointerLeave={() => setHover(null)}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  onExit(
                    low +
                      Math.min(
                        1,
                        Math.max(0, (event.clientX - rect.left) / rect.width),
                      ) *
                        (high - low),
                  );
                }}
              />
            </svg>
          </div>
          <div className="chart-readout">
            <span>
              TEST PRICE <strong>{fmtPrice(shown)}</strong>
            </span>
            <span>
              NET PNL{" "}
              <strong
                className={
                  result && result.netPnl < 0 ? "negative" : "positive"
                }
              >
                {result ? signedUsd(result.netPnl) : "—"}
              </strong>
            </span>
            <span>
              ROI{" "}
              <strong
                className={result && result.roi < 0 ? "negative" : "positive"}
              >
                {result ? signedPct(result.roi) : "—"}
              </strong>
            </span>
          </div>
          <div className="price-path">
            <div className="price-path-head">
              <strong>Drag the price path</strong>
              <span>Move the handle to preview the outcome</span>
            </div>
            <div className="price-path-track">
              <div className="price-path-line" />
              <span
                className="price-path-entry"
                style={{ left: `${entryPct}%` }}
              >
                <i />
                ENTRY
              </span>
              {liquidationPct !== null &&
                liquidationPct >= 0 &&
                liquidationPct <= 100 && (
                  <span
                    className="price-path-liquidation"
                    style={{ left: `${liquidationPct}%` }}
                  >
                    <i />
                    LIQUIDATION
                  </span>
                )}
              <span
                className="price-path-preview"
                style={{ left: `${Math.min(100, Math.max(0, sliderPct))}%` }}
              >
                <i />
                PREVIEW
              </span>
              <input
                className="price-slider"
                aria-label="Drag preview price on liquidation path"
                type="range"
                min={low}
                max={high}
                step={(high - low) / 10000}
                value={Math.min(high, Math.max(low, exit))}
                onChange={(event) => onExit(Number(event.target.value))}
              />
            </div>
            <div className="price-path-values">
              <span>
                EST. LIQUIDATION{" "}
                <strong className="negative">
                  {liquidation ? `~${fmtPrice(liquidation)}` : "Unavailable"}
                </strong>
              </span>
              <span>
                ENTRY <strong>{fmtPrice(entry)}</strong>
              </span>
              <span>
                PREVIEW <strong>{fmtPrice(exit)}</strong>
              </span>
            </div>
            {result?.reachedLiquidation && (
              <p className="price-path-warning">
                Estimated liquidation triggers near{" "}
                {liquidation ? fmtPrice(liquidation) : "an unavailable level"}{" "}
                before the preview price. Simulated loss:{" "}
                {usd(result.collateral, 2)}. Actual execution may differ.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="empty-chart">
          Enter a price to explore liquidation and PnL.
        </div>
      )}
      <p className="fineprint">
        This uses your chosen maintenance margin and fee rates. Real liquidation
        uses mark price, risk tiers, funding, and exchange rules.
      </p>
    </Card>
  );
}

function makeCardCanvas(data: {
  asset: AssetSymbol;
  side: Side;
  entry: number;
  exit: number;
  margin: number;
  leverage: number;
  liquidation: number | null;
  pnl: number;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("Canvas unavailable");
  c.fillStyle = "#0a1113";
  c.fillRect(0, 0, 1080, 1350);
  c.fillStyle = "#1b2929";
  c.fillRect(65, 68, 950, 1214);
  c.strokeStyle = "#46615b";
  c.strokeRect(65, 68, 950, 1214);
  c.font = "700 46px Arial";
  c.fillStyle = "#e7f2ed";
  c.fillText("LEVERAGE LAB", 118, 160);
  c.fillStyle = "#41e7b0";
  c.fillRect(118, 202, 132, 8);
  c.font = "700 95px Arial";
  c.fillStyle = "#f4f8f5";
  c.fillText(`${data.asset}  ${data.side.toUpperCase()}`, 118, 367);
  c.font = "600 42px Arial";
  c.fillStyle = "#aabdb5";
  c.fillText(`${data.leverage}×  ·  SIMULATION`, 118, 430);
  c.font = "700 95px Arial";
  c.fillStyle = data.pnl < 0 ? "#ff7d83" : "#41e7b0";
  c.fillText(signedUsd(data.pnl), 118, 615);
  c.font = "600 30px Arial";
  c.fillStyle = "#94a8a0";
  c.fillText("ESTIMATED NET PNL", 118, 665);
  const rows = [
    ["ENTRY", fmtPrice(data.entry)],
    ["EXIT", fmtPrice(data.exit)],
    ["MARGIN", usd(data.margin, 2)],
    [
      "EST. LIQUIDATION",
      data.liquidation ? `~${fmtPrice(data.liquidation)}` : "Unavailable",
    ],
  ];
  rows.forEach(([label, value], i) => {
    const y = 770 + i * 100;
    c.font = "600 27px Arial";
    c.fillStyle = "#93a69e";
    c.fillText(label, 118, y);
    c.font = "700 34px Arial";
    c.fillStyle = "#e9f5ed";
    c.textAlign = "right";
    c.fillText(value, 962, y);
    c.textAlign = "left";
  });
  c.font = "26px Arial";
  c.fillStyle = "#8a9f96";
  c.fillText(
    "Educational estimate · Exchange liquidation may differ",
    118,
    1210,
  );
  return canvas;
}

export default function Home() {
  const [asset, setAsset] = useState<AssetSymbol>("BTC");
  const [side, setSide] = useState<Side>("long");
  const [mode, setMode] = useState<Mode>("isolated");
  const [entry, setEntry] = useState(0);
  const [exit, setExit] = useState(0);
  const [margin, setMargin] = useState(100);
  const [leverage, setLeverage] = useState(10);
  const [extraCollateral, setExtraCollateral] = useState(0);
  const [maintenancePct, setMaintenancePct] = useState(0.5);
  const [feePct, setFeePct] = useState(0.05);
  const [quotes, setQuotes] = useState<Partial<Record<AssetSymbol, Quote>>>({});
  const [catalog, setCatalog] = useState<CatalogAsset[]>([]);
  const [catalogSource, setCatalogSource] = useState("");
  const [catalogStale, setCatalogStale] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [priceState, setPriceState] = useState<
    "loading" | "live" | "unavailable"
  >("loading");
  const [manualEntry, setManualEntry] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [toast, setToast] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [exchange, setExchange] = useState("All");
  const quote = quotes[asset];
  const fallbackCatalog = useMemo<CatalogAsset[]>(
    () =>
      ASSETS.map((item) => ({
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        rank: 0,
        image: null,
        color: item.color,
        price: 0,
        change24h: null,
        asOf: "",
        source: "unavailable",
      })),
    [],
  );
  const marketAssets = catalog.length ? catalog : fallbackCatalog;
  const selected = useMemo<CatalogAsset>(() => {
    const base = marketAssets.find((item) => item.symbol === asset) ?? {
      id: asset,
      symbol: asset,
      name: asset,
      rank: 0,
      image: null,
      color: "#294b43",
      price: 0,
      change24h: null,
      asOf: "",
      source: "unavailable",
    };
    return quote
      ? {
          ...base,
          price: quote.price,
          asOf: quote.asOf,
          source: quote.source,
          change24h: quote.change24h ?? base.change24h,
        }
      : base;
  }, [marketAssets, asset, quote]);

  const refreshCatalog = useCallback(async () => {
    try {
      const response = await fetch("/api/assets");
      const data = (await response.json()) as {
        assets?: CatalogAsset[];
        source?: string;
        stale?: boolean;
      };
      if (!response.ok || !data.assets?.length)
        throw new Error("No market catalog");
      setCatalog(data.assets);
      setCatalogSource(data.source ?? "Market API");
      setCatalogStale(Boolean(data.stale));
      setQuotes((current) =>
        Object.fromEntries(
          data.assets!.map((item) => [
            item.symbol,
            current[item.symbol] && !current[item.symbol]?.snapshot
              ? current[item.symbol]
              : {
                  price: item.price,
                  source: item.source,
                  asOf: item.asOf,
                  change24h: item.change24h,
                  snapshot: true,
                },
          ]),
        ),
      );
      setPriceState("live");
    } catch {
      setCatalogStale(true);
      try {
        const response = await fetch("/api/prices");
        const data = (await response.json()) as {
          prices?: Record<string, Quote>;
        };
        if (response.ok && data.prices) {
          setQuotes((current) => ({ ...current, ...data.prices }));
          setPriceState("live");
          return;
        }
      } catch {
        /* Manual entry remains possible. */
      }
      setPriceState("unavailable");
    }
  }, []);
  useEffect(() => {
    refreshCatalog();
    const timer = setInterval(refreshCatalog, 5 * 60_000);
    return () => clearInterval(timer);
  }, [refreshCatalog]);
  useEffect(() => {
    if (!ASSETS.some((item) => item.symbol === asset)) return;
    let active = true;
    const refreshSelected = async () => {
      try {
        const response = await fetch(
          `/api/quote?symbol=${encodeURIComponent(asset)}`,
        );
        if (!response.ok) return;
        const fresh = (await response.json()) as Quote;
        if (active && Number.isFinite(fresh.price) && fresh.price > 0)
          setQuotes((current) => ({
            ...current,
            [asset]: { ...fresh, snapshot: false },
          }));
      } catch {
        /* Retain the dated catalog snapshot. */
      }
    };
    refreshSelected();
    const timer = setInterval(refreshSelected, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [asset]);
  useEffect(() => {
    let active = true;
    setContracts([]);
    fetch(`/api/contracts?asset=${asset}`)
      .then((response) => response.json())
      .then((data: { contracts?: Contract[] }) => {
        if (active && Array.isArray(data.contracts))
          setContracts(data.contracts);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [asset]);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const a = query.get("asset");
    if (a && a.length <= 32 && !/[<>]/.test(a)) setAsset(a);
    const s = query.get("side");
    if (s === "long" || s === "short") setSide(s);
    const m = query.get("mode");
    if (m === "isolated" || m === "cross") setMode(m);
    for (const [key, setter] of [
      ["entry", setEntry],
      ["exit", setExit],
      ["margin", setMargin],
      ["leverage", setLeverage],
      ["extra", setExtraCollateral],
      ["maintenance", setMaintenancePct],
      ["fee", setFeePct],
    ] as const) {
      const number = Number(query.get(key));
      if (Number.isFinite(number) && number > 0) {
        setter(number);
        if (key === "entry") setManualEntry(true);
      }
    }
    try {
      const records = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(records)) setSaved(records.slice(0, 8));
    } catch {
      /* Ignore corrupt local records. */
    }
  }, []);
  useEffect(() => {
    if (!manualEntry && quote?.price) {
      setEntry(quote.price);
      setExit((old) => (old > 0 ? old : quote.price * 1.03));
    }
  }, [quote?.price, manualEntry]);
  useEffect(() => {
    if (!entry) return;
    const params = new URLSearchParams({
      asset,
      side,
      mode,
      entry: String(entry),
      margin: String(margin),
      leverage: String(leverage),
      exit: String(exit),
      extra: String(extraCollateral),
      maintenance: String(maintenancePct),
      fee: String(feePct),
    });
    const timeout = setTimeout(
      () => window.history.replaceState(null, "", `?${params}`),
      400,
    );
    return () => clearTimeout(timeout);
  }, [
    asset,
    side,
    mode,
    entry,
    margin,
    leverage,
    exit,
    extraCollateral,
    maintenancePct,
    feePct,
  ]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const input = {
    entry,
    margin,
    leverage,
    side,
    exit,
    mode,
    extraCollateral,
    maintenanceRate: maintenancePct / 100,
    feeRate: feePct / 100,
  };
  const result = useMemo(
    () => simulate(input),
    [
      entry,
      margin,
      leverage,
      side,
      exit,
      mode,
      extraCollateral,
      maintenancePct,
      feePct,
    ],
  );
  const scenarios = useMemo(
    () =>
      [-10, -5, -3, -1, 0, 1, 3, 5, 10].map((change) => ({
        change,
        price: entry * (1 + change / 100),
        result: simulate({ ...input, exit: entry * (1 + change / 100) }),
      })),
    [
      entry,
      margin,
      leverage,
      side,
      mode,
      extraCollateral,
      maintenancePct,
      feePct,
    ],
  );
  const updateAsset = useCallback(
    (symbol: AssetSymbol) => {
      setAsset(symbol);
      setManualEntry(false);
      const price = quotes[symbol]?.price ?? 0;
      setEntry(price);
      setExit(price ? price * 1.03 : 0);
    },
    [quotes],
  );
  const showToast = (message: string) => setToast(message);
  const save = () => {
    const next: Saved[] = [
      {
        id: Date.now(),
        asset,
        side,
        mode,
        entry,
        margin,
        leverage,
        exit,
        extraCollateral,
        maintenanceRate: maintenancePct,
        feeRate: feePct,
      },
      ...saved,
    ].slice(0, 8);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSaved(next);
    showToast("Simulation saved on this device.");
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Shareable link copied.");
    } catch {
      showToast("Copy the URL from your browser to share this setup.");
    }
  };
  const exportImage = async (copy = false) => {
    if (!result) return;
    const canvas = makeCardCanvas({
      asset,
      side,
      entry,
      exit,
      margin,
      leverage,
      liquidation: result.liquidation,
      pnl: result.netPnl,
    });
    if (
      copy &&
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined"
    ) {
      try {
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error("No image"))),
            "image/png",
          ),
        );
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        showToast("Image copied.");
        return;
      } catch {
        /* Download as a recoverable fallback. */
      }
    }
    const link = document.createElement("a");
    link.download = `${asset.toLowerCase()}-leverage-simulation.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("PNG downloaded.");
  };
  const exportPdf = async () => {
    if (!result) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFillColor(10, 17, 19);
    pdf.rect(0, 0, 210, 297, "F");
    pdf.setTextColor(65, 231, 176);
    pdf.setFontSize(13);
    pdf.text("LEVERAGE LAB / SIMULATION REPORT", 18, 25);
    pdf.setTextColor(235, 245, 240);
    pdf.setFontSize(28);
    pdf.text(`${asset} ${side.toUpperCase()} · ${leverage}x`, 18, 49);
    pdf.setFontSize(14);
    const rows = [
      ["Entry", fmtPrice(entry)],
      ["Exit", fmtPrice(exit)],
      ["Margin", usd(margin, 2)],
      ["Exposure", usd(result.notional, 2)],
      ["Quantity", `${nf.format(result.quantity)} ${asset}`],
      [
        "Est. liquidation",
        result.liquidation ? fmtPrice(result.liquidation) : "Unavailable",
      ],
      ["Net PnL", signedUsd(result.netPnl)],
      ["ROI on margin", signedPct(result.roi)],
      ["Maintenance rate", `${maintenancePct}%`],
      ["Fee per side", `${feePct}%`],
    ];
    rows.forEach(([label, value], i) => {
      pdf.setTextColor(145, 165, 156);
      pdf.text(label, 18, 73 + i * 15);
      pdf.setTextColor(235, 245, 240);
      pdf.text(value, 192, 73 + i * 15, { align: "right" });
    });
    pdf.setFontSize(10);
    pdf.setTextColor(145, 165, 156);
    pdf.text(
      "Educational estimate. Actual exchange liquidation and PnL may differ.",
      18,
      261,
    );
    pdf.text(`Generated ${new Date().toISOString()}`, 18, 271);
    pdf.save(`${asset.toLowerCase()}-leverage-simulation.pdf`);
  };
  const loadSaved = (record: Saved) => {
    setAsset(record.asset);
    setSide(record.side);
    setMode(record.mode);
    setEntry(record.entry);
    setMargin(record.margin);
    setLeverage(record.leverage);
    setExit(record.exit);
    setExtraCollateral(record.extraCollateral);
    setMaintenancePct(record.maintenanceRate);
    setFeePct(record.feeRate);
    setManualEntry(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="header-actions">
          <span className={`live-pill ${priceState}`}>
            <span className="status-dot" />
            {priceState === "live"
              ? catalogStale
                ? "MARKET DATA DELAYED"
                : quote?.snapshot
                  ? "MARKET SNAPSHOT"
                  : "MARKET FEED LIVE"
              : priceState === "loading"
                ? "CONNECTING"
                : "PRICE UNAVAILABLE"}
          </span>
          <button className="quiet-button" onClick={share}>
            ↗ <span>Share setup</span>
          </button>
        </div>
      </header>
      <main>
        <div className="hero">
          <div>
            <span className="eyebrow">
              THE TRADING RISK WORKSPACE <span className="eyebrow-line" />
            </span>
            <h1>
              Know the risk.
              <br />
              <em>Before the position.</em>
            </h1>
            <p>
              Test the trade before you take it. Live market references,
              transparent liquidation estimates, and every dollar of upside or
              downside in one view.
            </p>
          </div>
          <div className="hero-note">
            <span className="hero-note-icon">◎</span>
            <strong>Built for clarity</strong>
            <span>
              Simulation only. No wallet connection or trade execution.
            </span>
          </div>
        </div>
        <div className="workspace">
          <Card className="setup-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">01 / TRADE SETUP</span>
                <h2>Build the position</h2>
              </div>
              <span className="section-aside">ALL CALCULATIONS ON DEVICE</span>
            </div>
            <AssetPicker
              assets={marketAssets}
              selected={selected}
              onSelect={updateAsset}
              loading={priceState === "loading"}
              stale={catalogStale}
              source={catalogSource}
            />
            <div className="field">
              <span className="field-label">DIRECTION</span>
              <div className="segmented">
                <button
                  className={side === "long" ? "active long" : ""}
                  onClick={() => setSide("long")}
                >
                  ↗ LONG
                </button>
                <button
                  className={side === "short" ? "active short" : ""}
                  onClick={() => setSide("short")}
                >
                  ↘ SHORT
                </button>
              </div>
            </div>
            <div className="entry-label">
              <button
                className="text-action"
                disabled={!quote}
                onClick={() => {
                  if (quote) {
                    setEntry(quote.price);
                    setManualEntry(false);
                  }
                }}
              >
                ↻ Use market
              </button>
            </div>
            <NumberField
              label="ENTRY PRICE"
              value={entry}
              onChange={(value) => {
                setEntry(value);
                setManualEntry(true);
              }}
              decimals={12}
              hint={
                quote
                  ? `${quote.snapshot ? "Market snapshot" : "Live quote"} ${asset} ${fmtPrice(quote.price)} · ${quote.source} · ${new Date(quote.asOf).toLocaleTimeString()}`
                  : priceState === "loading"
                    ? "Checking live market sources…"
                    : "Live price unavailable. Enter a price manually."
              }
            />
            <NumberField
              label="YOUR MARGIN"
              value={margin}
              onChange={setMargin}
              decimals={2}
              hint="Capital allocated to this position."
            />
            <div className="preset-row">
              {[10, 25, 50, 100, 250, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  className={margin === amount ? "selected" : ""}
                  onClick={() => setMargin(amount)}
                >
                  {usd(amount, 0)}
                </button>
              ))}
            </div>
            <div className="leverage-head">
              <span className="field-label">LEVERAGE</span>
              <strong>{leverage}×</strong>
            </div>
            <input
              aria-label="Leverage"
              className="leverage-slider"
              type="range"
              min="1"
              max="150"
              value={leverage}
              onChange={(event) => setLeverage(Number(event.target.value))}
            />
            <div className="leverage-options">
              {[1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150].map((amount) => (
                <button
                  key={amount}
                  className={leverage === amount ? "selected" : ""}
                  onClick={() => setLeverage(amount)}
                >
                  {amount}×
                </button>
              ))}
            </div>
            <p className="tiny-note">
              Theoretical leverage up to 150×. Availability depends on the
              exchange and contract.
            </p>
            <div className="field">
              <span className="field-label">MARGIN MODE</span>
              <div className="segmented">
                <button
                  className={mode === "isolated" ? "active neutral" : ""}
                  onClick={() => setMode("isolated")}
                >
                  Isolated
                </button>
                <button
                  className={mode === "cross" ? "active neutral" : ""}
                  onClick={() => setMode("cross")}
                >
                  Cross
                </button>
              </div>
            </div>
            {mode === "cross" && (
              <NumberField
                label="ADDITIONAL ACCOUNT COLLATERAL"
                value={extraCollateral}
                onChange={setExtraCollateral}
                hint="Cross mode can risk this extra eligible collateral. Other positions are not modeled."
              />
            )}
            <button
              className="disclosure"
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
            >
              Advanced risk assumptions <span>{advanced ? "−" : "+"}</span>
            </button>
            {advanced && (
              <div className="advanced-fields">
                <NumberField
                  label="MAINTENANCE MARGIN"
                  value={maintenancePct}
                  onChange={setMaintenancePct}
                  prefix="%"
                  decimals={3}
                  hint="Generic default: 0.5%. Check the selected contract tier."
                />
                <NumberField
                  label="TAKER FEE PER SIDE"
                  value={feePct}
                  onChange={setFeePct}
                  prefix="%"
                  decimals={3}
                  hint="Applied to both entry and exit; funding is excluded."
                />
              </div>
            )}
          </Card>
          <div className="right-stack">
            <Card className="summary-card">
              <div className="summary-top">
                <div className="summary-asset">
                  <AssetIcon asset={selected} size={47} />
                  <div>
                    <span className="eyebrow">02 / POSITION SUMMARY</span>
                    <h2>
                      {asset}{" "}
                      <span
                        className={
                          side === "long" ? "direction-long" : "direction-short"
                        }
                      >
                        {side.toUpperCase()}
                      </span>
                    </h2>
                  </div>
                </div>
                <strong className="leverage-badge">{leverage}×</strong>
              </div>
              <div className="metric-grid">
                <div>
                  <span>YOUR MARGIN</span>
                  <strong>{usd(margin, 2)}</strong>
                </div>
                <div>
                  <span>TOTAL EXPOSURE</span>
                  <strong>{usd(result?.notional ?? 0)}</strong>
                </div>
                <div>
                  <span>QUANTITY</span>
                  <strong>
                    {result ? nf.format(result.quantity) : "—"}{" "}
                    <small>{asset}</small>
                  </strong>
                </div>
                <div>
                  <span>EST. LIQUIDATION</span>
                  <strong className="negative">
                    {result?.liquidation
                      ? `~${fmtPrice(result.liquidation)}`
                      : "—"}
                  </strong>
                </div>
              </div>
              <div className="outcome-grid">
                <div className="outcome-primary">
                  <span>NET PNL AT EXIT</span>
                  <strong
                    className={
                      result && result.netPnl < 0 ? "negative" : "positive"
                    }
                  >
                    {result ? signedUsd(result.netPnl) : "—"}
                  </strong>
                  <small>
                    ROI ON MARGIN <b>{result ? signedPct(result.roi) : "—"}</b>
                  </small>
                </div>
                <div className="outcome-secondary">
                  <span>LIQUIDATION DISTANCE</span>
                  <strong>
                    {result?.liquidationDistance != null
                      ? `${result.liquidationDistance.toFixed(2)}%`
                      : "—"}
                  </strong>
                  <small>
                    {mode === "cross"
                      ? "Eligible collateral at risk"
                      : "Margin at risk"}
                    : {usd(result?.collateral ?? margin, 2)}
                  </small>
                </div>
              </div>
              {result?.reachedLiquidation && (
                <div className="alert danger">
                  The price path crosses the estimated liquidation level.
                  Simulated loss is capped at {usd(result.collateral, 2)}.
                </div>
              )}
              {!result?.liquidation && entry > 0 && (
                <div className="alert warning">
                  These assumptions leave no valid liquidation level. Check
                  leverage, collateral, maintenance rate, and fees.
                </div>
              )}
              <p className="summary-foot">
                Estimate for a linear USD-margined position. Actual mark price,
                risk tiers, funding, fees, and exchange margin rules can change
                liquidation.
              </p>
            </Card>
            <Chart
              entry={entry}
              exit={exit}
              liquidation={result?.liquidation ?? null}
              margin={margin}
              leverage={leverage}
              side={side}
              mode={mode}
              extraCollateral={extraCollateral}
              maintenanceRate={maintenancePct / 100}
              feeRate={feePct / 100}
              onExit={setExit}
            />
          </div>
        </div>
        <div className="lower-grid">
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">03 / WHAT-IF ENGINE</span>
                <h2>Exit & PnL scenarios</h2>
                <p>Set a target price or compare market moves.</p>
              </div>
            </div>
            <NumberField
              label="EXIT PRICE"
              value={exit}
              onChange={setExit}
              decimals={12}
            />
            <div className="preset-row move-preset">
              {[-10, -5, -3, -1, 1, 3, 5, 10].map((change) => (
                <button
                  key={change}
                  onClick={() => setExit(entry * (1 + change / 100))}
                >
                  {change > 0 ? "+" : ""}
                  {change}%
                </button>
              ))}
            </div>
            <div className="scenario-summary">
              <div>
                <span>MARKET MOVE</span>
                <strong
                  className={
                    result && result.move < 0 ? "negative" : "positive"
                  }
                >
                  {result ? signedPct(result.move) : "—"}
                </strong>
              </div>
              <div>
                <span>LEVERAGED ROI</span>
                <strong
                  className={result && result.roi < 0 ? "negative" : "positive"}
                >
                  {result ? signedPct(result.roi) : "—"}
                </strong>
              </div>
              <div>
                <span>FEES EST.</span>
                <strong>{result ? usd(result.fees, 2) : "—"}</strong>
              </div>
            </div>
          </Card>
          <Card className="table-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">SCENARIO GRID</span>
                <h2>One move, many outcomes</h2>
              </div>
              <span className="section-aside">PATH-AWARE ESTIMATE</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{asset} MOVE</th>
                    <th>EXIT PRICE</th>
                    <th>NET PNL</th>
                    <th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map(({ change, price, result: row }) => (
                    <tr
                      key={change}
                      className={change === 0 ? "reference-row" : ""}
                    >
                      <td>
                        {change > 0 ? "+" : ""}
                        {change}%
                      </td>
                      <td>{entry ? fmtPrice(price) : "—"}</td>
                      <td
                        className={
                          row?.netPnl && row.netPnl < 0
                            ? "negative"
                            : "positive"
                        }
                      >
                        {row
                          ? row.reachedLiquidation
                            ? "LIQUIDATED"
                            : signedUsd(row.netPnl)
                          : "—"}
                      </td>
                      <td>{row ? signedPct(row.roi) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <Card className="exchange-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">EXCHANGE REALITY CHECK</span>
              <h2>Check contract rules before trading</h2>
              <p>
                Public contract maxima are checked when available; account
                limits and tiers may differ.
              </p>
            </div>
            <span className="section-aside">
              {contracts.filter((item) => item.maxLeverage).length} LIVE
              VERIFIED
            </span>
          </div>
          <div className="filter-row">
            {[
              "All",
              "Binance",
              "Bybit",
              "OKX",
              "Bitget",
              "Hyperliquid",
              "Kraken",
              "Coinbase",
            ].map((name) => (
              <button
                key={name}
                className={exchange === name ? "selected" : ""}
                onClick={() => setExchange(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="exchange-grid">
            {[
              {
                name: "Binance",
                url: "https://www.binance.com/en/futures/trading-rules/perpetual/leverage-margin",
                note: "Futures trading rules",
              },
              {
                name: "Bybit",
                url: "https://www.bybit.com/en/help-center/article/Risk-Limit-Perpetual-and-Futures",
                note: "Risk limit and tiers",
              },
              {
                name: "OKX",
                url: "https://www.okx.com/docs-v5/en/#public-data-rest-api-get-instruments",
                note: "Perpetual contract rules",
              },
              {
                name: "Bitget",
                url: "https://www.bitget.com/api-doc/contract/market/Get-All-Symbols-Contracts",
                note: "Futures contract rules",
              },
              {
                name: "Hyperliquid",
                url: "https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications",
                note: "Contract specifications",
              },
              {
                name: "Kraken",
                url: "https://support.kraken.com/articles/360022632452-derivatives-contract-specifications",
                note: "Derivatives specifications",
              },
              {
                name: "Coinbase",
                url: "https://www.coinbase.com/learn/advanced-trading/understanding-derivatives",
                note: "Derivatives rules",
              },
            ]
              .filter((item) => exchange === "All" || exchange === item.name)
              .map((item) => {
                const contract = contracts.find(
                  (row) => row.name === item.name,
                );
                return (
                  <div className="exchange-tile" key={item.name}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{contract?.contract ?? item.note}</span>
                    </div>
                    <div className="contract-value">
                      <span>PUBLIC MAX LEVERAGE</span>
                      <strong>
                        {contract?.maxLeverage
                          ? `${contract.maxLeverage}×`
                          : "Verify on exchange"}
                      </strong>
                    </div>
                    <span
                      className={`verify-badge ${contract?.maxLeverage ? "verified" : ""}`}
                    >
                      {contract?.maxLeverage
                        ? leverage <= contract.maxLeverage
                          ? `${leverage}× PUBLICLY SUPPORTED`
                          : `${leverage}× ABOVE PUBLIC MAX`
                        : "UNVERIFIED"}
                    </span>
                    <a
                      href={contract?.source || item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Official source ↗
                    </a>
                  </div>
                );
              })}
          </div>
          <p className="fineprint">
            A public maximum is not a guarantee for your account or size. Real
            available leverage and liquidation depend on the contract, region,
            margin mode, risk tier, and account controls.
          </p>
        </Card>
        <div className="lower-grid final-grid">
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">04 / SHAREABLE OUTPUT</span>
                <h2>Take the setup with you</h2>
                <p>A clean snapshot of the position and its assumptions.</p>
              </div>
            </div>
            <div className="share-preview">
              <Brand small />
              <span className="preview-watermark">SIMULATION ONLY</span>
              <h3>
                {asset} <span>{side.toUpperCase()}</span> · {leverage}×
              </h3>
              <strong
                className={
                  result && result.netPnl < 0 ? "negative" : "positive"
                }
              >
                {result ? signedUsd(result.netPnl) : "—"}
              </strong>
              <div>
                <span>ENTRY {entry ? fmtPrice(entry) : "—"}</span>
                <span>EXIT {exit ? fmtPrice(exit) : "—"}</span>
                <span>
                  EST. LIQ.{" "}
                  {result?.liquidation ? fmtPrice(result.liquidation) : "—"}
                </span>
              </div>
            </div>
            <div className="export-actions">
              <button onClick={() => exportImage()}>↓ Download PNG</button>
              <button onClick={() => exportImage(true)}>▣ Copy image</button>
              <button onClick={exportPdf}>↓ Export PDF</button>
              <button onClick={share}>↗ Share link</button>
              <button onClick={save}>＋ Save locally</button>
            </div>
          </Card>
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">STORED ON THIS DEVICE</span>
                <h2>Recent simulations</h2>
                <p>Saved in this browser. No account required.</p>
              </div>
            </div>
            {saved.length ? (
              <div className="saved-list">
                {saved.map((record) => (
                  <div key={record.id}>
                    <button onClick={() => loadSaved(record)}>
                      <span>
                        <strong>
                          {record.asset} {record.side.toUpperCase()} ·{" "}
                          {record.leverage}×
                        </strong>
                        <small>
                          {fmtPrice(record.entry)} entry ·{" "}
                          {usd(record.margin, 2)} margin
                        </small>
                      </span>
                      <span>Open ↗</span>
                    </button>
                    <button
                      className="delete-saved"
                      aria-label={`Delete saved ${record.asset} simulation`}
                      onClick={() => {
                        const next = saved.filter(
                          (item) => item.id !== record.id,
                        );
                        setSaved(next);
                        localStorage.setItem(storageKey, JSON.stringify(next));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-saved">
                <span>◇</span>
                <strong>No saved setups yet</strong>
                <p>Save your current simulation to revisit it here.</p>
              </div>
            )}
          </Card>
        </div>
        <footer>
          <Brand small />
          <p>
            Educational simulation only. No wallet, orders, or financial advice.
            Quotes are public market references; execution prices and
            liquidation rules vary.
          </p>
          <span>© {new Date().getFullYear()} LEVERAGE LAB</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
