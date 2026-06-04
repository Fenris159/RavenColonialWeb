import { ConcreteEconomy, getSiteType, siteTypes } from "./site-data";
import { SiteMap2 } from "./system-model2";

export const OPERATIONAL_MARKET_ID_MIN = 4_200_000_001;

const aletheiaUnlocksAthenaHightech = (s: SiteMap2, calcIds?: string[]): boolean => {
  if (s.buildType !== "aletheia" || s.status === "demolish") {
    return false;
  }
  if (calcIds?.length && !calcIds.includes(s.id)) {
    return false;
  }

  // Live / Spansh: complete comms with operational market id
  if (s.status === "complete") {
    return (s.marketId ?? 0) >= OPERATIONAL_MARKET_ID_MIN;
  }

  // Planning (useIncomplete): plan/build aletheia in the calc set → predict 140% when finished
  if (s.status === "plan" || s.status === "build") {
    return !!calcIds?.includes(s.id);
  }

  return false;
};

/** Operational comms on the same body unlocks 140% hightech on athena (IC 1805 Spansh). */
export const bodyHasOperationalCommsForAthena = (site: SiteMap2, calcIds?: string[]): boolean => {
  const onBody = site.body?.sites ?? [];
  return onBody.some(s => aletheiaUnlocksAthenaHightech(s, calcIds));
};

/** How a hub/installation intrinsic is determined (1.0 = 100% Spansh strength). */
export type FacilityRegistryEntry =
  | {
      kind: "linkOnly";
      /** Spansh usually reports no economy object for these. */
      notes?: string;
    }
  | {
      kind: "fixed";
      intrinsic: number;
      /** RC `type.inf` this applies to */
      economy: ConcreteEconomy;
      notes?: string;
      /** Systems / sample counts used when calibrating (dev registry audit). */
      evidence?: { samples: number; spanshPercents: number[]; systems?: string[] };
    }
  | {
      kind: "athenaComms";
      economy: "hightech";
      withoutComms: number;
      withOperationalComms: number;
      notes?: string;
      evidence?: { samples: number; spanshPercents: number[]; systems?: string[] };
    };

export const FACILITY_BUILD_TYPES: string[] = siteTypes
  .filter(t => t.buildClass === "hub" || t.buildClass === "installation")
  .flatMap(t => [...t.subTypes, ...(t.altTypes ?? [])]);

const entryForBuildType = (buildType: string): FacilityRegistryEntry | undefined => {
  const type = getSiteType(buildType, true);
  if (!type || (type.buildClass !== "hub" && type.buildClass !== "installation")) {
    return undefined;
  }
  return FACILITY_ECONOMY_REGISTRY[buildType];
};

/**
 * Spansh-aligned facility economy registry.
 * Spansh harvest: see local/docs/facility-economy-registry.md (not in git).
 */
export const FACILITY_ECONOMY_REGISTRY: Record<string, FacilityRegistryEntry> = {
  // --- Installations: link-only (inf none) ---
  angelia: { kind: "linkOnly", notes: "Satellite; unlocks only" },
  eirene: { kind: "linkOnly", notes: "Satellite" },
  hermes: { kind: "linkOnly", notes: "Satellite" },
  aletheia: { kind: "linkOnly", notes: "Comms; unlocks athena 140% / UC" },
  pistis: { kind: "linkOnly", notes: "Comms variant" },
  soter: { kind: "linkOnly", notes: "Comms variant" },
  harmonia: { kind: "linkOnly", notes: "Government" },

  // --- Hubs: link-only ---
  aegle: {
    kind: "linkOnly",
    notes: "RC inf none; HR 4464 Spansh once showed refinery 140% (verify buildType match)",
  },
  io: {
    kind: "linkOnly",
    notes: "RC inf none; HR 4464 Spansh once showed military 100%",
  },

  // --- Installations: fixed intrinsics (default 100% until evidence overrides) ---
  demeter: {
    kind: "fixed",
    economy: "agriculture",
    intrinsic: 1.0,
    notes: "Space farm; strong-link source for ports",
  },
  apate: { kind: "fixed", economy: "service", intrinsic: 1.0 },
  laverna: { kind: "fixed", economy: "service", intrinsic: 1.0 },
  euthenia: { kind: "fixed", economy: "extraction", intrinsic: 1.0 },
  phorcys: { kind: "fixed", economy: "extraction", intrinsic: 1.0 },
  enodia: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  ichnaea: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  alastor: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  vacuna: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  dicaeosyne: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  eunomia: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  nomos: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  poena: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  asclepius: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  eupraxia: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  astraeus: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  coeus: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  dione: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  dodona: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  hedone: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },
  opora: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },
  pasithea: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },
  bacchus: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },
  dionysus: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },

  // --- Hubs: fixed / conditional ---
  athena: {
    kind: "athenaComms",
    economy: "hightech",
    withoutComms: 1.0,
    withOperationalComms: 1.4,
    notes: "Scientific hub; 140% when operational aletheia on same body",
    evidence: {
      samples: 36,
      spanshPercents: [100, 140],
      systems: ["IC 1805 Sector FH-B c14-13"],
    },
  },
  caelus: {
    kind: "fixed",
    economy: "hightech",
    intrinsic: 1.0,
    evidence: { samples: 1, spanshPercents: [100], systems: ["IC 1805 Sector FH-B c14-13"] },
  },
  tartarus: { kind: "fixed", economy: "extraction", intrinsic: 1.0 },
  tellus_e: { kind: "fixed", economy: "tourism", intrinsic: 1.0 },
  alala: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  ares: { kind: "fixed", economy: "military", intrinsic: 1.0 },
  janus: { kind: "fixed", economy: "hightech", intrinsic: 1.0 },
  eunostus: {
    kind: "fixed",
    economy: "industrial",
    intrinsic: 1.4,
    evidence: { samples: 1, spanshPercents: [140], systems: ["HR 4464"] },
  },
  molae: { kind: "fixed", economy: "industrial", intrinsic: 1.0 },
  tellus_i: { kind: "fixed", economy: "industrial", intrinsic: 1.0 },
  tellus: { kind: "fixed", economy: "industrial", intrinsic: 1.0 },
  silenus: {
    kind: "fixed",
    economy: "refinery",
    intrinsic: 1.0,
    notes: "HR 4464 samples had empty Spansh economies; default 100% until confirmed",
  },
};

export interface FacilityRegistryTableRow {
  buildType: string;
  buildClass: string;
  inf: string;
  rule: string;
  modelRange: string;
  samples: number | null;
  spanshObserved: string;
  notes: string;
}

export const buildFacilityRegistryTable = (): FacilityRegistryTableRow[] => {
  const rows: FacilityRegistryTableRow[] = [];

  for (const buildType of FACILITY_BUILD_TYPES) {
    const type = getSiteType(buildType, true);
    if (!type) continue;

    const entry = FACILITY_ECONOMY_REGISTRY[buildType];
    let rule = "—";
    let modelRange = "—";
    let samples: number | null = null;
    let spanshObserved = "—";
    let notes = "";

    if (entry) {
      notes = entry.notes ?? "";
      if ("evidence" in entry && entry.evidence) {
        samples = entry.evidence.samples;
        const p = entry.evidence.spanshPercents;
        spanshObserved = p?.length ? `${Math.min(...p)}–${Math.max(...p)}%` : "—";
      }
      switch (entry.kind) {
        case "linkOnly":
          rule = "linkOnly";
          modelRange = "(no economy %)";
          break;
        case "fixed":
          rule = "fixed";
          modelRange = `${Math.round(entry.intrinsic * 100)}% ${entry.economy}`;
          break;
        case "athenaComms":
          rule = "athenaComms";
          modelRange = `${Math.round(entry.withoutComms * 100)}% / ${Math.round(entry.withOperationalComms * 100)}% ${entry.economy}`;
          break;
      }
    } else {
      rule = "MISSING";
    }

    rows.push({
      buildType,
      buildClass: type.buildClass,
      inf: type.inf,
      rule,
      modelRange,
      samples,
      spanshObserved,
      notes,
    });
  }

  return rows.sort((a, b) => a.buildClass.localeCompare(b.buildClass) || a.buildType.localeCompare(b.buildType));
};

/** Ensure every hub/installation subtype has a registry row. */
export const assertFacilityRegistryComplete = (): string[] => {
  const missing: string[] = [];
  for (const bt of FACILITY_BUILD_TYPES) {
    if (!FACILITY_ECONOMY_REGISTRY[bt]) {
      missing.push(bt);
    }
  }
  return missing;
};

export const getFacilityRegistryEntry = (buildType: string): FacilityRegistryEntry | undefined =>
  entryForBuildType(buildType);

export const resolveFacilityIntrinsicFromRegistry = (
  site: SiteMap2,
  calcIds?: string[],
): number => {
  const entry = getFacilityRegistryEntry(site.buildType);
  const inf = site.type.inf;

  if (inf === "none" || !entry) {
    return 0;
  }

  switch (entry.kind) {
    case "linkOnly":
      return 0;
    case "fixed":
      if (entry.economy !== inf) {
        return entry.intrinsic;
      }
      return entry.intrinsic;
    case "athenaComms":
      return bodyHasOperationalCommsForAthena(site, calcIds)
        ? entry.withOperationalComms
        : entry.withoutComms;
    default:
      return 1.0;
  }
};

export const describeFacilityRegistryEntry = (buildType: string): string => {
  const entry = getFacilityRegistryEntry(buildType);
  const type = getSiteType(buildType, true);
  if (!entry) {
    return `${buildType}: (no registry row)`;
  }
  if (!type) {
    return `${buildType}: unknown type`;
  }
  switch (entry.kind) {
    case "linkOnly":
      return `${buildType}: link-only (${type.displayName})`;
    case "fixed":
      return `${buildType}: ${Math.round(entry.intrinsic * 100)}% ${entry.economy}`;
    case "athenaComms":
      return `${buildType}: ${Math.round(entry.withoutComms * 100)}–${Math.round(entry.withOperationalComms * 100)}% ${entry.economy}`;
    default:
      return buildType;
  }
};
