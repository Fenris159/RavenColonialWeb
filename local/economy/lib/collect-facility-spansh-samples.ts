import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";
import { getSiteType, siteTypes } from "../../../src/site-data";
import { bodyHasOperationalCommsForAthena } from "../../../src/economy/economy-facility-registry";
import {
  buildGalaxyStationLookup,
  resolveFreshGalaxyStationForSite,
  type GalaxyStationLookup,
} from "./galaxy-stations-matching";
import {
  extractGalaxyStationsInRange,
  findGalaxySystemRange,
} from "./extract-galaxy-stations-range";
import * as fs from "fs";
import {
  collectGalaxyStations,
  extractSystemAtName,
  GalaxyStationEconomy,
  GalaxySystem,
  normalizeGalaxyEconomies,
  RC_ECONOMY_KEYS,
  RcEconomyKey,
} from "./galaxy-stations-util";
import { isOperationalMarketId } from "./spansh-verify-utils";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

export interface FacilitySpanshSample {
  systemName: string;
  siteName: string;
  buildType: string;
  buildClass: string;
  inf: string;
  marketId: number;
  spanshEconomies: Partial<Record<RcEconomyKey, number>>;
  primarySpanshPercent: number | null;
  hasOperationalAletheiaOnBody: boolean;
  spanshEmpty: boolean;
}

export interface BuildTypeSpanshAggregate {
  buildType: string;
  buildClass: string;
  inf: string;
  sampleCount: number;
  spanshEmptyCount: number;
  primaryPercents: number[];
  allEconomyKeys: Partial<Record<RcEconomyKey, number[]>>;
  withComms140: number;
  withoutComms100: number;
  otherPercents: number[];
  systems: string[];
}

export const isFacilityBuildType = (buildType: string): boolean => {
  const t = getSiteType(buildType, true);
  return t?.buildClass === "hub" || t?.buildClass === "installation";
};

export const collectFacilitySpanshSamples = (
  systemName: string,
  sys: Sys,
  galaxyLookup: GalaxyStationLookup,
  maxAgeMs = THREE_MONTHS_MS,
): FacilitySpanshSample[] => {
  const sysMap = buildSystemModel2(sys, false, true, {
    enableTerraformableAgricultureBonus: false,
  });
  const samples: FacilitySpanshSample[] = [];

  for (const site of sysMap.siteMaps) {
    if (site.status !== "complete" || !isFacilityBuildType(site.buildType)) {
      continue;
    }
    if (!isOperationalMarketId(site.marketId)) {
      continue;
    }

    const resolved = resolveFreshGalaxyStationForSite(
      { name: site.name, marketId: site.marketId },
      galaxyLookup,
      maxAgeMs,
    );
    if (!resolved.station) {
      continue;
    }

    const spanshEconomies = resolved.station.economies;
    const spanshEmpty = Object.keys(spanshEconomies).length === 0;
    const inf = site.type.inf;
    let primarySpanshPercent: number | null = null;
    if (inf !== "none" && typeof spanshEconomies[inf as RcEconomyKey] === "number") {
      primarySpanshPercent = spanshEconomies[inf as RcEconomyKey]!;
    } else if (!spanshEmpty) {
      const top = RC_ECONOMY_KEYS.map(k => spanshEconomies[k] ?? 0).sort((a, b) => b - a)[0];
      primarySpanshPercent = top > 0 ? top : null;
    }

    samples.push({
      systemName,
      siteName: site.name,
      buildType: site.buildType,
      buildClass: site.type.buildClass,
      inf,
      marketId: site.marketId!,
      spanshEconomies,
      primarySpanshPercent,
      hasOperationalAletheiaOnBody: bodyHasOperationalCommsForAthena(site, sysMap.calcIds),
      spanshEmpty,
    });
  }

  return samples;
};

export const aggregateFacilitySpanshSamples = (
  samples: FacilitySpanshSample[],
): Record<string, BuildTypeSpanshAggregate> => {
  const byType: Record<string, BuildTypeSpanshAggregate> = {};

  for (const s of samples) {
    if (!byType[s.buildType]) {
      const type = getSiteType(s.buildType, true);
      byType[s.buildType] = {
        buildType: s.buildType,
        buildClass: type?.buildClass ?? s.buildClass,
        inf: type?.inf ?? s.inf,
        sampleCount: 0,
        spanshEmptyCount: 0,
        primaryPercents: [],
        allEconomyKeys: {},
        withComms140: 0,
        withoutComms100: 0,
        otherPercents: [],
        systems: [],
      };
    }
    const agg = byType[s.buildType];
    agg.sampleCount++;
    if (s.spanshEmpty) {
      agg.spanshEmptyCount++;
    }
    if (!agg.systems.includes(s.systemName)) {
      agg.systems.push(s.systemName);
    }
    if (s.primarySpanshPercent !== null) {
      agg.primaryPercents.push(s.primarySpanshPercent);
      if (s.buildType === "athena") {
        if (s.primarySpanshPercent === 140 && s.hasOperationalAletheiaOnBody) {
          agg.withComms140++;
        } else if (s.primarySpanshPercent === 100 && !s.hasOperationalAletheiaOnBody) {
          agg.withoutComms100++;
        } else {
          agg.otherPercents.push(s.primarySpanshPercent);
        }
      }
    }
    for (const key of RC_ECONOMY_KEYS) {
      const v = s.spanshEconomies[key];
      if (typeof v === "number") {
        if (!agg.allEconomyKeys[key]) {
          agg.allEconomyKeys[key] = [];
        }
        agg.allEconomyKeys[key]!.push(v);
      }
    }
  }

  return byType;
};

export const suggestRegistryEntry = (
  agg: BuildTypeSpanshAggregate,
): { kind: string; detail: string; intrinsic?: number } => {
  if (agg.inf === "none" || agg.spanshEmptyCount >= agg.sampleCount * 0.8) {
    return { kind: "linkOnly", detail: `${agg.spanshEmptyCount}/${agg.sampleCount} empty Spansh economies` };
  }

  if (agg.buildType === "athena" && agg.sampleCount > 0) {
    return {
      kind: "athenaComms",
      detail: `100%×${agg.withoutComms100} 140%×${agg.withComms140} other=${agg.otherPercents.join(",")}`,
    };
  }

  const percents = agg.primaryPercents;
  if (percents.length === 0) {
    return { kind: "fixed", detail: "no primary percent (default 100%)", intrinsic: 1.0 };
  }

  const counts = new Map<number, number>();
  for (const p of percents) {
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topPct, topCount] = sorted[0];
  const intrinsic = topPct / 100;
  const pctShare = topCount / percents.length;
  return {
    kind: "fixed",
    detail: `dominant ${topPct}% (${topCount}/${percents.length}, ${Math.round(pctShare * 100)}%) range ${Math.min(...percents)}–${Math.max(...percents)}`,
    intrinsic,
  };
};

const readGalaxyCacheFile = (cachePath: string): GalaxyStationEconomy[] | null => {
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  const cached = JSON.parse(fs.readFileSync(cachePath, "utf8")) as
    | GalaxyStationEconomy[]
    | { stations: GalaxyStationEconomy[] };
  return Array.isArray(cached) ? cached : cached.stations ?? null;
};

/** Prefer verified station cache JSON; else parse full system object from dump. */
export const loadGalaxyStationsForSystem = async (
  dumpPath: string,
  systemName: string,
  id64: number,
  cachePath?: string,
): Promise<GalaxyStationEconomy[]> => {
  const fromCache = cachePath ? readGalaxyCacheFile(cachePath) : null;
  if (fromCache?.length) {
    return fromCache;
  }

  try {
    const system = (await extractSystemAtName(dumpPath, systemName, id64)) as GalaxySystem;
    const stations = collectGalaxyStations(system);
    if (stations.length > 0) {
      return stations;
    }
  } catch {
    // fall through to byte-range regex
  }

  const { start, end } = findGalaxySystemRange(dumpPath, systemName, id64);
  const raw = extractGalaxyStationsInRange(dumpPath, start, end);
  return raw.map(s => ({
    marketId: s.marketId,
    name: s.name,
    updated: s.updated,
    economies: normalizeGalaxyEconomies(s.economies),
  }));
};

export const listAllFacilityBuildTypes = (): { buildType: string; inf: string; buildClass: string }[] =>
  siteTypes
    .filter(t => t.buildClass === "hub" || t.buildClass === "installation")
    .flatMap(t =>
      [...t.subTypes, ...(t.altTypes ?? [])].map(buildType => ({
        buildType,
        inf: t.inf,
        buildClass: t.buildClass,
      })),
    );
