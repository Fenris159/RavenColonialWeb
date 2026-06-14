import type { GalaxyStationEconomy } from "./galaxy-stations-util";
import { isSpanshFresh } from "./galaxy-stations-util";
import { isOperationalMarketId, isPlayerMadeMarketId } from "./spansh-verify-utils";

/** Normalize station names for Spansh ↔ RC matching (case/punctuation insensitive). */
export const normalizeStationName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type GalaxyStationMatchKind = "marketId" | "name" | "none" | "ambiguous";

export interface GalaxyStationLookup {
  byMarketId: Record<number, GalaxyStationEconomy>;
  byNormalizedName: Record<string, GalaxyStationEconomy[]>;
}

export interface ResolvedGalaxyStation {
  station: GalaxyStationEconomy | null;
  kind: GalaxyStationMatchKind;
  note?: string;
}

export const buildGalaxyStationLookup = (
  stations: GalaxyStationEconomy[],
  options?: { playerMadeOnly?: boolean },
): GalaxyStationLookup => {
  const byMarketId: Record<number, GalaxyStationEconomy> = {};
  const byNormalizedName: Record<string, GalaxyStationEconomy[]> = {};

  for (const station of stations) {
    if (options?.playerMadeOnly && !isPlayerMadeMarketId(station.marketId)) {
      continue;
    }
    byMarketId[station.marketId] = station;
    const key = normalizeStationName(station.name);
    if (!byNormalizedName[key]) {
      byNormalizedName[key] = [];
    }
    byNormalizedName[key].push(station);
  }

  return { byMarketId, byNormalizedName };
};

const pickNewestStation = (candidates: GalaxyStationEconomy[]): GalaxyStationEconomy => {
  return [...candidates].sort((a, b) => {
    const ta = new Date(a.updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
    const tb = new Date(b.updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
    return tb - ta;
  })[0];
};

/** Spansh row has at least one economy percentage (operational station). */
export const spanshStationHasEconomies = (station: GalaxyStationEconomy): boolean =>
  Object.keys(station.economies).length > 0;

const scoreNameMatchCandidate = (station: GalaxyStationEconomy): number => {
  let score = 0;
  if (spanshStationHasEconomies(station)) score += 100;
  if (isOperationalMarketId(station.marketId)) score += 10;
  return score;
};

const pickBestNameMatch = (candidates: GalaxyStationEconomy[]): GalaxyStationEconomy => {
  const ranked = [...candidates].sort((a, b) => {
    const scoreDiff = scoreNameMatchCandidate(b) - scoreNameMatchCandidate(a);
    if (scoreDiff !== 0) return scoreDiff;
    const ta = new Date(a.updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
    const tb = new Date(b.updated.replace(" ", "T").replace(/\+00$/, "Z")).getTime();
    return tb - ta;
  });
  return ranked[0];
};

const resolveByNormalizedName = (
  site: { name: string; marketId?: number },
  lookup: GalaxyStationLookup,
): ResolvedGalaxyStation | null => {
  const key = normalizeStationName(site.name);
  const candidates = lookup.byNormalizedName[key] ?? [];
  if (candidates.length === 0) {
    return null;
  }

  const station = candidates.length === 1 ? candidates[0] : pickBestNameMatch(candidates);
  const idNote =
    typeof site.marketId === "number" && station.marketId !== site.marketId
      ? `name match (RC ${site.marketId} vs Spansh ${station.marketId})`
      : undefined;

  return {
    station,
    kind: candidates.length === 1 ? "name" : "ambiguous",
    note:
      candidates.length === 1
        ? idNote
        : `${candidates.length} Spansh rows share name "${site.name}"; using best operational row`,
  };
};

/**
 * Infer the operational Spansh `marketId` for an RC site when the journal id still points at a
 * construction placeholder row but the dump has a named operational station (e.g. RC 396* → 436*).
 */
export const inferOperationalMarketIdFromGalaxy = (
  site: { name: string; marketId?: number },
  lookup: GalaxyStationLookup,
): number | undefined => {
  const resolved = resolveGalaxyStationForSite(site, lookup);
  if (!resolved.station || !spanshStationHasEconomies(resolved.station)) {
    return undefined;
  }
  return resolved.station.marketId;
};

export interface ResolveGalaxyStationOptions {
  /** When true, match normalized station name before journal marketId. */
  preferNameMatch?: boolean;
}

/**
 * Resolve Spansh dump row for an RC site.
 * Default: journal `marketId` when that row has economies; else normalized name.
 * With `preferNameMatch` or when RC has no operational marketId, name is tried first
 * (undockable / construction sites often lack a journal id).
 */
export const resolveGalaxyStationForSite = (
  site: { name: string; marketId?: number },
  lookup: GalaxyStationLookup,
  options?: ResolveGalaxyStationOptions,
): ResolvedGalaxyStation => {
  const byId =
    typeof site.marketId === "number" ? lookup.byMarketId[site.marketId] : undefined;
  const nameFirst =
    !!options?.preferNameMatch || !isOperationalMarketId(site.marketId);

  const tryName = (): ResolvedGalaxyStation | null => {
    const byName = resolveByNormalizedName(site, lookup);
    if (!byName) {
      return null;
    }
    if (byId && byId.marketId !== byName.station.marketId) {
      return {
        ...byName,
        note: [byName.note, `name-first over RC marketId ${site.marketId}`]
          .filter(Boolean)
          .join("; "),
      };
    }
    if (byId && !spanshStationHasEconomies(byId)) {
      return {
        ...byName,
        note: [byName.note, `ignored empty construction row RC marketId ${site.marketId}`]
          .filter(Boolean)
          .join("; "),
      };
    }
    return byName;
  };

  if (nameFirst) {
    const byName = tryName();
    if (byName) {
      return byName;
    }
    if (byId && spanshStationHasEconomies(byId)) {
      return { station: byId, kind: "marketId", note: "name match failed; used marketId" };
    }
  } else if (byId && spanshStationHasEconomies(byId)) {
    return { station: byId, kind: "marketId" };
  }

  const byName = tryName();
  if (byName) {
    return byName;
  }

  if (byId) {
    return { station: byId, kind: "marketId", note: "marketId row has no Spansh economies" };
  }

  return { station: null, kind: "none" };
};

export const resolveFreshGalaxyStationForSite = (
  site: { name: string; marketId?: number },
  lookup: GalaxyStationLookup,
  maxAgeMs: number,
  options?: ResolveGalaxyStationOptions,
): ResolvedGalaxyStation & { fresh: boolean } => {
  const resolved = resolveGalaxyStationForSite(site, lookup, options);
  if (!resolved.station) {
    return { ...resolved, fresh: false };
  }
  const fresh = isSpanshFresh(resolved.station.updated, maxAgeMs);
  return { ...resolved, fresh };
};
