import type { GetRealEconomies } from "./api/v2-system";
import type { StationEDSM } from "./types";
import { EconomyMap } from "./system-model2";

/** Case/punctuation insensitive station name (game: unique per system). */
export const normalizeStationName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Construction / placeholder Spansh row (colony-only), not an operational port economy. */
export const isConstructionSpanshPlaceholder = (economies: EconomyMap | undefined): boolean => {
  if (!economies) {
    return true;
  }
  const nonZero = Object.entries(economies).filter(([, v]) => (v ?? 0) > 0);
  if (nonZero.length === 0) {
    return true;
  }
  return nonZero.every(([k]) => k === "colony");
};

export const findRealEconomiesRow = (
  realEconomies: GetRealEconomies[] | undefined,
  marketId: number,
): GetRealEconomies | undefined => {
  if (!realEconomies?.length || !Number.isFinite(marketId)) {
    return undefined;
  }
  return realEconomies.find(r => {
    const id = typeof r.id === "number" ? r.id : parseInt(String(r.id).replace(/^\D/, ""), 10);
    return id === marketId;
  });
};

export const buildEdsmMarketIdByNormalizedName = (
  stations: StationEDSM[] | undefined,
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!stations?.length) {
    return out;
  }
  for (const st of stations) {
    const marketId = parseInt(st.marketId, 10);
    if (!Number.isFinite(marketId) || marketId <= 0) {
      continue;
    }
    const key = normalizeStationName(st.name);
    if (!key) {
      continue;
    }
    out[key] = marketId;
  }
  return out;
};

export type SpanshEconomyMatchKind = "marketId" | "edsmName" | "none";

export interface ResolvedSpanshEconomy {
  row: GetRealEconomies;
  spanshMarketId: number;
  kind: SpanshEconomyMatchKind;
  note?: string;
}

export interface SpanshCompareSite {
  name: string;
  marketId?: number;
  status?: string;
}

/**
 * Resolve Spansh compare row for a completed RC site.
 * Uses journal marketId first; falls back to EDSM name → marketId when the id row is missing or colony-only.
 */
export const resolveSpanshEconomyForSite = (
  site: SpanshCompareSite,
  realEconomies: GetRealEconomies[] | undefined,
  edsmMarketIdByName: Record<string, number> | undefined,
): ResolvedSpanshEconomy | null => {
  if (site.status && site.status !== "complete") {
    return null;
  }

  const tryMarketId = (marketId: number, kind: SpanshEconomyMatchKind, note?: string): ResolvedSpanshEconomy | null => {
    const row = findRealEconomiesRow(realEconomies, marketId);
    if (!row || isConstructionSpanshPlaceholder(row.economies)) {
      return null;
    }
    return { row, spanshMarketId: marketId, kind, note };
  };

  if (typeof site.marketId === "number" && site.marketId > 0) {
    const byId = tryMarketId(site.marketId, "marketId");
    if (byId) {
      return byId;
    }
  }

  const edsmMarketId = edsmMarketIdByName?.[normalizeStationName(site.name)];
  if (typeof edsmMarketId === "number") {
    const byName = tryMarketId(
      edsmMarketId,
      "edsmName",
      typeof site.marketId === "number" && site.marketId !== edsmMarketId
        ? `EDSM name match (RC marketId ${site.marketId} → Spansh ${edsmMarketId})`
        : undefined,
    );
    if (byName) {
      return byName;
    }
  }

  return null;
};
