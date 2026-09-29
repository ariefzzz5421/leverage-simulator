"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogAsset } from "@/lib/market.mjs";

function priceLabel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "Price unavailable";
  const digits =
    value >= 100
      ? 0
      : value >= 1
        ? 2
        : Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(value))));
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function AssetIcon({
  asset,
  size = 34,
}: {
  asset: Pick<CatalogAsset, "image" | "name" | "symbol" | "color">;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset.image]);
  return (
    <span
      className="coin-icon"
      style={{
        width: size,
        height: size,
        background: asset.color || "#294b43",
      }}
    >
      {asset.image && !failed ? (
        <img
          src={asset.image}
          alt={`${asset.name} logo`}
          width={size}
          height={size}
          loading={size > 40 ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{asset.symbol.slice(0, 2)}</span>
      )}
    </span>
  );
}

function Picker({
  assets,
  selected,
  onSelect,
  loading,
  stale,
  source,
}: {
  assets: CatalogAsset[];
  selected: CatalogAsset;
  onSelect: (symbol: string) => void;
  loading: boolean;
  stale: boolean;
  source: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const filtered = useMemo(
    () =>
      assets.filter((item) =>
        `${item.symbol} ${item.name} ${item.rank}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [assets, query],
  );
  useEffect(() => {
    if (open) search.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const select = (symbol: string) => {
    onSelect(symbol);
    setOpen(false);
    setQuery("");
  };
  return (
    <div className="asset-picker field" ref={root}>
      <span className="field-label">
        ASSET{" "}
        <span className="asset-count">
          {loading
            ? "Loading market…"
            : assets.length >= 100
              ? "100 non-stable assets"
              : "Market catalog unavailable"}
        </span>
      </span>
      <button
        type="button"
        className="asset-trigger"
        aria-label="Choose crypto asset"
        aria-expanded={open}
        aria-controls="asset-options"
        onClick={() => setOpen((value) => !value)}
      >
        <AssetIcon asset={selected} size={36} />
        <span className="asset-trigger-main">
          <strong>
            {selected.symbol}{" "}
            <small>{selected.rank > 0 ? `#${selected.rank}` : ""}</small>
          </strong>
          <span>{selected.name}</span>
        </span>
        <span className="asset-trigger-price">
          <strong>{priceLabel(selected.price)}</strong>
          {selected.change24h != null && (
            <small className={selected.change24h < 0 ? "negative" : "positive"}>
              {selected.change24h >= 0 ? "+" : ""}
              {selected.change24h.toFixed(2)}%
            </small>
          )}
        </span>
        <span className="select-chevron">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && (
        <div
          className="asset-popover"
          id="asset-options"
          role="dialog"
          aria-label="Choose crypto asset"
        >
          <div className="asset-search">
            <span aria-hidden="true">⌕</span>
            <input
              ref={search}
              aria-label="Search assets"
              placeholder="Search symbol, name, or rank…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "Enter" && filtered[0])
                  select(filtered[0].symbol);
              }}
            />
          </div>
          <div className="asset-results">
            {filtered.length ? (
              filtered.map((item) => (
                <button
                  type="button"
                  className={`asset-option ${selected.symbol === item.symbol ? "active" : ""}`}
                  key={item.id}
                  onClick={() => select(item.symbol)}
                >
                  <AssetIcon asset={item} size={32} />
                  <span className="asset-option-main">
                    <strong>
                      {item.symbol} <small>{item.name}</small>
                    </strong>
                    <span>
                      Market rank{" "}
                      {item.rank > 0 ? `#${item.rank}` : "unavailable"}
                    </span>
                  </span>
                  <span className="asset-option-price">
                    <strong>{priceLabel(item.price)}</strong>
                    {item.change24h != null && (
                      <small
                        className={item.change24h < 0 ? "negative" : "positive"}
                      >
                        {item.change24h >= 0 ? "+" : ""}
                        {item.change24h.toFixed(2)}%
                      </small>
                    )}
                  </span>
                </button>
              ))
            ) : (
              <div className="asset-no-results">
                No matching asset in this market catalog.
              </div>
            )}
          </div>
          <div className="asset-source">
            {stale ? "Delayed market snapshot" : "Market snapshot"} ·{" "}
            {source || "source unavailable"} · original market ranks shown
          </div>
        </div>
      )}
    </div>
  );
}

export const AssetPicker = memo(Picker);
