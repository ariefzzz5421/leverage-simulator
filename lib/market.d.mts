export type CatalogAsset = {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  image: string | null;
  color: string;
  price: number;
  change24h: number | null;
  asOf: string;
  source: string;
};
export function isStablecoin(
  asset: Pick<CatalogAsset, "id" | "symbol" | "name">,
  stableIds?: Set<string>,
): boolean;
export function topNonStable(
  assets: CatalogAsset[],
  stableIds?: Set<string>,
  count?: number,
): CatalogAsset[];
