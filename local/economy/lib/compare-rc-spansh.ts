import { buildSystemModel2, SiteMap2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";
import { EconomyMap } from "../../../src/site-data";
import { isUndockableFacility, spanshMismatchIsInformational } from "../../../src/economy/compare/spansh-compare-reliability";
import {
  buildGalaxyStationLookup,
  normalizeStationName,
  resolveFreshGalaxyStationForSite,
  type GalaxyStationLookup,
  type GalaxyStationMatchKind,
} from "./galaxy-stations-matching";
import { RC_ECONOMY_KEYS, RcEconomyKey, type GalaxyStationEconomy } from "./galaxy-stations-util";
import { isPlayerMadeMarketId } from "./spansh-verify-utils";
import { BT } from "../../../src/types2";

const roundPct = (v: number) => Math.round(v * 100);

const BODY_TYPE_LABEL: Record<string, string> = {
  [BT.rb]: "rocky",
  [BT.ib]: "icy",
  [BT.hmc]: "hmc",
  [BT.mrb]: "mrb",
  [BT.ri]: "rocky-ice",
  [BT.elw]: "elw",
  [BT.ww]: "ww",
  [BT.aw]: "ammonia",
  [BT.gg]: "gas-giant",
  [BT.wg]: "water-giant",
  [BT.ac]: "asteroid",
  [BT.st]: "star",
};

export interface BodyContext {
  bodyName: string;
  bodyType: string;
  features: string[];
  orbital: boolean;
}

export interface EconomyMismatch {
  economy: RcEconomyKey;
  model: number;
  spansh: number;
  diff: number;
}

export interface CompareRow {
  name: string;
  marketId: number;
  spanshMarketId?: number;
  matchKind: GalaxyStationMatchKind;
  matchNote?: string;
  buildType: string;
  buildClass: string;
  body: BodyContext;
  modelSkipped: boolean;
  undockableFacility: boolean;
  fresh: boolean;
  mismatches: EconomyMismatch[];
  matches: RcEconomyKey[];
  spanshOnly?: Partial<Record<RcEconomyKey, number>>;
}

export interface CompareReport {
  generatedAt: string;
  systemName: string;
  id64: number;
  matchedFresh: number;
  modelCompared: number;
  modelFullMatch: number;
  modelFullMatchDockable: number;
  modelComparedDockable: number;
  informationalMismatchRows: number;
  noSpansh: number;
  staleSkipped: number;
  spanshOnlyFresh: number;
  rows: CompareRow[];
  byEconomy: Record<string, { match: number; mismatch: number; sumDiff: number }>;
  byBuildType: Record<string, { ports: number; fullMatch: number; mismatchRows: number; modelSkipped: number }>;
}

export interface CompareOptions {
  maxAgeMs?: number;
  enableTerraformableAgricultureBonus?: boolean;
  /** Match Spansh rows by normalized name before journal marketId. */
  preferNameMatch?: boolean;
}

const formatBodyContext = (site: SiteMap2): BodyContext => ({
  bodyName: site.body?.name ?? "?",
  bodyType: BODY_TYPE_LABEL[site.body?.type ?? ""] ?? String(site.body?.type ?? "?"),
  features: (site.body?.features ?? []).map(f => String(f)),
  orbital: site.type.orbital,
});

const compareEconomies = (
  site: SiteMap2,
  galaxy: GalaxyStationEconomy,
): Pick<CompareRow, "mismatches" | "matches" | "spanshOnly"> => {
  const mismatches: EconomyMismatch[] = [];
  const matches: RcEconomyKey[] = [];
  const spanshOnly: Partial<Record<RcEconomyKey, number>> = {};

  for (const key of RC_ECONOMY_KEYS) {
    const spanshVal = galaxy.economies[key];
    if (typeof spanshVal !== "number") continue;

    if (!site.economies) {
      spanshOnly[key as RcEconomyKey] = spanshVal;
      continue;
    }

    const model = roundPct(site.economies[key as keyof EconomyMap] ?? 0);
    if (model === spanshVal) {
      matches.push(key);
    } else if (model > 0 || spanshVal > 0) {
      mismatches.push({ economy: key, model, spansh: spanshVal, diff: model - spanshVal });
    }
  }

  return { mismatches, matches, spanshOnly: Object.keys(spanshOnly).length ? spanshOnly : undefined };
};

export const runSystemCompare = (
  sys: Sys,
  allGalaxyStations: GalaxyStationEconomy[],
  options?: CompareOptions,
): CompareReport => {
  const maxAgeMs = options?.maxAgeMs ?? 90 * 24 * 60 * 60 * 1000;
  const sysMap = buildSystemModel2(sys, false, true, {
    enableTerraformableAgricultureBonus: options?.enableTerraformableAgricultureBonus ?? false,
  });

  const galaxyLookup = buildGalaxyStationLookup(allGalaxyStations, { playerMadeOnly: true });
  const rows: CompareRow[] = [];
  let matchedFresh = 0;
  let modelCompared = 0;
  let modelFullMatch = 0;
  let modelFullMatchDockable = 0;
  let modelComparedDockable = 0;
  let modelSkippedRows = 0;
  let noSpansh = 0;
  let staleSkipped = 0;
  let nameMatched = 0;
  let marketIdMatched = 0;
  let informationalMismatchRows = 0;

  for (const site of sysMap.siteMaps) {
    if (site.status !== "complete") continue;

    const resolved = resolveFreshGalaxyStationForSite(
      { name: site.name, marketId: site.marketId },
      galaxyLookup,
      maxAgeMs,
      { preferNameMatch: options?.preferNameMatch },
    );

    if (!resolved.station) {
      noSpansh++;
      continue;
    }
    if (!resolved.fresh) {
      staleSkipped++;
      continue;
    }

    matchedFresh++;
    if (resolved.kind === "marketId") marketIdMatched++;
    else if (resolved.kind === "name" || resolved.kind === "ambiguous") nameMatched++;

    const modelSkipped = !site.economies;
    const undockableFacility = isUndockableFacility(site.type);
    if (modelSkipped) modelSkippedRows++;
    else modelCompared++;

    const { mismatches, matches, spanshOnly } = compareEconomies(site, resolved.station);
    if (!modelSkipped && mismatches.length === 0 && !spanshOnly) modelFullMatch++;
    if (!modelSkipped) {
      if (!undockableFacility) {
        modelComparedDockable++;
        if (mismatches.length === 0 && !spanshOnly) modelFullMatchDockable++;
      }
      if (mismatches.length > 0 && spanshMismatchIsInformational(site.type)) {
        informationalMismatchRows++;
      }
    }

    rows.push({
      name: site.name,
      marketId: site.marketId ?? 0,
      spanshMarketId: resolved.station.marketId,
      matchKind: resolved.kind,
      matchNote: resolved.note,
      buildType: site.buildType,
      buildClass: site.type.buildClass,
      body: formatBodyContext(site),
      modelSkipped,
      undockableFacility,
      fresh: true,
      mismatches,
      matches,
      spanshOnly,
    });
  }

  rows.sort((a, b) => b.mismatches.length - a.mismatches.length);

  const rcNames = new Set(
    sysMap.siteMaps.filter(s => s.status === "complete").map(s => normalizeStationName(s.name)),
  );
  const spanshOnlyStations = allGalaxyStations.filter(s => {
    if (!isPlayerMadeMarketId(s.marketId)) return false;
    const resolved = resolveFreshGalaxyStationForSite(
      { name: s.name, marketId: s.marketId },
      galaxyLookup,
      maxAgeMs,
      { preferNameMatch: options?.preferNameMatch },
    );
    return resolved.fresh && !rcNames.has(normalizeStationName(s.name));
  });

  const byEconomy: CompareReport["byEconomy"] = {};
  for (const key of RC_ECONOMY_KEYS) {
    byEconomy[key] = { match: 0, mismatch: 0, sumDiff: 0 };
  }
  for (const row of rows.filter(r => !r.modelSkipped)) {
    for (const m of row.matches) byEconomy[m].match++;
    for (const m of row.mismatches) {
      byEconomy[m.economy].mismatch++;
      byEconomy[m.economy].sumDiff += m.diff;
    }
  }

  const byBuildType: CompareReport["byBuildType"] = {};
  for (const row of rows) {
    const bt = row.buildType || "?";
    if (!byBuildType[bt]) {
      byBuildType[bt] = { ports: 0, fullMatch: 0, mismatchRows: 0, modelSkipped: 0 };
    }
    byBuildType[bt].ports++;
    if (row.modelSkipped) byBuildType[bt].modelSkipped++;
    else if (row.mismatches.length === 0 && !row.spanshOnly) byBuildType[bt].fullMatch++;
    else if (!row.modelSkipped) byBuildType[bt].mismatchRows++;
  }

  return {
    generatedAt: new Date().toISOString(),
    systemName: sys.name,
    id64: sys.id64,
    matchedFresh,
    modelCompared,
    modelFullMatch,
    modelFullMatchDockable,
    modelComparedDockable,
    informationalMismatchRows,
    noSpansh,
    staleSkipped,
    spanshOnlyFresh: spanshOnlyStations.length,
    rows,
    byEconomy,
    byBuildType,
  };
};

export const formatCompareSummary = (report: CompareReport): string => {
  const lines: string[] = [];
  lines.push(`\n=== ${report.systemName} RC vs Spansh ===`);
  lines.push(`Matched fresh: ${report.matchedFresh}, model compared: ${report.modelCompared}`);
  lines.push(
    `Full match: ${report.modelFullMatch}${report.modelCompared ? ` (${Math.round((100 * report.modelFullMatch) / report.modelCompared)}%)` : ""}`,
  );
  lines.push(
    `Dockable: ${report.modelComparedDockable} compared, ${report.modelFullMatchDockable} full match`,
  );
  lines.push(`No Spansh: ${report.noSpansh}, stale: ${report.staleSkipped}, Spansh-only: ${report.spanshOnlyFresh}`);

  lines.push("\nPer-economy:");
  for (const key of RC_ECONOMY_KEYS) {
    const b = report.byEconomy[key];
    if (b.match + b.mismatch > 0) {
      const avg = b.mismatch ? (b.sumDiff / b.mismatch).toFixed(1) : "0";
      lines.push(`  ${key}: ${b.match} ok, ${b.mismatch} bad, avg Δ ${avg}pp`);
    }
  }

  const top = report.rows.filter(r => !r.modelSkipped && r.mismatches.length > 0).slice(0, 12);
  if (top.length) {
    lines.push("\nTop mismatches:");
    for (const row of top) {
      lines.push(
        `  ${row.name.slice(0, 40)} (${row.buildType}): ${row.mismatches.map(m => `${m.economy} ${m.model}%→${m.spansh}%`).join("; ")}`,
      );
    }
  }

  return lines.join("\n");
};
