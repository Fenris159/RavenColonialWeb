import { EconomyMap } from "./site-data";
import {
  adjust,
  bodyIsTidalToStar,
  matches,
} from "./economy-core";
import type { SiteMap2, SysMap2 } from "./system-model2";
import { BodyFeature } from "./types";
import { Bod, BT } from "./types2";

/** Spansh-derived agriculture rules — not in the community colonization sheet. */

/** Documented weak-link agriculture increment (community sheet). */
export const WEAK_LINK_AGRICULTURE_DELTA = 0.05;

/** Weak-link agriculture budgets expressed as economy strength (0.90 = 90%). */
export const AG_WEAK_LINK_BUDGET = {
  /** Colony port with no same-body agriculture strong link (rb / default bodies). */
  DEFAULT: 0.90,
  /** HMC/MRB surface outpost (atropos / nona). */
  HMC_OUTPOST: 0.30,
  /** HMC/MRB colony starport with no same-body agriculture strong link. */
  HMC_STARPORT: 1.60,
  /** Extra weak-link slice when a ceres/fornax on the same body provides a strong link. */
  SAME_BODY_SETTLEMENT: 1.10,
  /** Extra weak-link slice when a demeter/picumnus on the same body provides a strong link. */
  SAME_BODY_FACILITY: 0.15,
  /** ELW/WW ag-primary hab colony with T1 colony ag strong link. */
  HAB_WORLD_T1_COLONY: 0.55,
  /** Icy fixed non-ag port with organics or tidal penalty. */
  ICY_FIXED: 0.25,
  /** Same-body colony agriculture strong link on non-hab world. */
  NON_HAB_COLONY_STRONG: 0.05,
  /** Tidal hab-world ag colony. */
  TIDAL_HAB: 0.50,
} as const;

/**
 * Spansh-regressed weak-link agriculture budgets by colony port buildType (HR 4464 and peers).
 * Orbital cluster types (plutus / vulcan / prometheus) use subordinate-count tiers instead — see below.
 */
export const AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE: Readonly<Record<string, number>> = {
  hestia: 1.60,
  poseidon: 1.60,
  apollo: 1.60,
  clotho: 1.25,
  chronos: 1.40,
  /** Civilian surface outpost near agriculture cluster (IC 1805 Spansh). */
  atropos: 1.40,
};

/** Small/medium agriculture settlements (Spansh intrinsic 60%). */
export const TIER1_AGRICULTURE_SETTLEMENT_BUILD_TYPES = new Set(["picumnus", "annona", "consus"]);

export const getSettlementFixedEconomyValue = (site: SiteMap2): number => {
  if (
    site.type.inf === "agriculture" &&
    TIER1_AGRICULTURE_SETTLEMENT_BUILD_TYPES.has(site.buildType)
  ) {
    return 0.6;
  }
  return 1.0;
};

export const getAgricultureSettlementFloorValue = (site: SiteMap2): number =>
  getSettlementFixedEconomyValue(site);

/** plutus / vulcan / prometheus on orbital colony ports: budget scales with strong subordinate count. */
export const AG_WEAK_LINK_ORBITAL_CLUSTER_BUILD_TYPES = new Set(["plutus", "vulcan", "prometheus"]);

export const getOrbitalClusterAgWeakLinkBudget = (site: SiteMap2): number => {
  const subs = site.links?.strongSites?.length ?? 0;
  if (subs >= 3) {
    return 1.15;
  }
  if (subs >= 1) {
    return 1.40;
  }
  return AG_WEAK_LINK_BUDGET.DEFAULT;
};

/** Non-ag-specialized colony port (body BIO/ELW may still add agriculture to intrinsic). */
const isColonyPortWithoutSameBodyAgStrong = (site: SiteMap2) =>
  (site.type.buildClass === "starport" || site.type.buildClass === "outpost") &&
  site.type.inf === "colony" &&
  site.type.fixed !== "agriculture" &&
  !site.agEconomyCalc?.sameBodyAgFacilityStrongLink &&
  !site.agEconomyCalc?.sameBodyAgSettlementStrongLink;

const hasObservedBuildTypeWeakLinkBudget = (site: SiteMap2) =>
  site.buildType in AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE;

const usesOrbitalClusterWeakLinkBudget = (site: SiteMap2) =>
  AG_WEAK_LINK_ORBITAL_CLUSTER_BUILD_TYPES.has(site.buildType) &&
  site.type.orbital;

/** @deprecated Use AG_WEAK_LINK_BUDGET + weakLinkBudgetToMaxSources */
export const AG_WEAK_LINK_CAP_DEFAULT = weakLinkBudgetToMaxSources(AG_WEAK_LINK_BUDGET.DEFAULT);

/** @deprecated Use AG_WEAK_LINK_BUDGET + weakLinkBudgetToMaxSources */
export const AG_WEAK_LINK_CAP_SAME_BODY_STRONG = weakLinkBudgetToMaxSources(AG_WEAK_LINK_BUDGET.SAME_BODY_SETTLEMENT);

/** @deprecated Use AG_WEAK_LINK_BUDGET + weakLinkBudgetToMaxSources */
export const AG_WEAK_LINK_CAP_HMC_STARPORT = weakLinkBudgetToMaxSources(AG_WEAK_LINK_BUDGET.HMC_STARPORT);

export function weakLinkBudgetToMaxSources(budget: number): number {
  if (budget <= 0) {
    return 0;
  }
  return Math.floor(budget / WEAK_LINK_AGRICULTURE_DELTA + 1e-9);
}

export function maxSourcesToWeakLinkBudget(maxSources: number): number {
  return Math.round(maxSources * WEAK_LINK_AGRICULTURE_DELTA * 100) / 100;
}

export const getAgricultureStrongLinkSourceValue = (source: SiteMap2, tierCoefficient: number): number => {
  if (source.type.inf !== 'agriculture') {
    return tierCoefficient;
  }

  // Space farms (demeter / picumnus) strong-link ports by tier coefficient, not full facility strength.
  if (source.type.buildClass === "installation") {
    return tierCoefficient;
  }

  const sourceAg = source.economies?.agriculture;
  if (sourceAg !== undefined && sourceAg > 0) {
    return Math.max(tierCoefficient, sourceAg);
  }

  return tierCoefficient;
};

export const applyObservedPresetEconomies = (map: EconomyMap, site: SiteMap2) => {
  if (site.buildType !== 'atropos' || site.body?.type !== BT.ib || site.body?.features.includes(BodyFeature.bio)) {
    return;
  }

  // Preset targets subordinate icy atropos outposts (HR 4464 / IC 1805), not body primaries (e.g. Whelk on 9 c).
  if (site === site.body?.orbitalPrimary || site === site.body?.surfacePrimary) {
    return;
  }

  adjust('extraction', +0.65, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
  adjust('agriculture', +0.55, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
  adjust('refinery', +0.35, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
  adjust('military', +0.30, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
  adjust('industrial', +0.25, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
  adjust('hightech', +0.15, 'Observed preset economy: Civilian Surface Outpost (Atropos)', map, site);
};

export const getColonyAgricultureStrongLinkSourceValue = (
  source: SiteMap2,
  site: SiteMap2,
  tierCoefficient: number,
  getColonyAgricultureIntrinsic: (site: SiteMap2) => number,
) => {
  if (source.body !== site.body || source.type.inf !== 'colony') {
    return tierCoefficient;
  }

  const sourceAg = getColonyAgricultureIntrinsic(source);
  if (source.type.tier < site.type.tier) {
    return tierCoefficient + Math.max(0, sourceAg - tierCoefficient) * 0.75;
  }

  let value = Math.max(tierCoefficient, sourceAg);
  if (matches([BT.elw, BT.ww], site.body?.type) && tierCoefficient > 1.0) {
    value = Math.max(value, sourceAg + (tierCoefficient - 1.0) * 1.125);
  }

  return value;
};

const isAgTourismColonyAgricultureWeakSource = (source: SiteMap2, site: SiteMap2) => {
  return source.type.inf === 'colony' &&
    source.primaryEconomy === 'agriculture' &&
    source.intrinsic?.includes('agriculture') &&
    source.intrinsic?.includes('tourism') &&
    source.body !== site.body &&
    site.type.orbital &&
    site.type.tier === 1 &&
    !site.type.fixed;
};

export const shouldApplyAgricultureWeakLink = (source: SiteMap2, site: SiteMap2) => {
  return !isAgTourismColonyAgricultureWeakSource(source, site);
};

const shouldLimitForeignStarAgricultureWeakLinks = (site: SiteMap2) => {
  return site.type.inf === 'colony' &&
    !site.type.fixed &&
    !site.type.orbital &&
    !site.intrinsic?.includes('agriculture');
};

const getBodyStarRoot = (sys: SysMap2, body: Bod | undefined) => {
  let current = body;

  while (current) {
    if (current.type === BT.st) {
      return current.num;
    }

    const parentNum = current.parents?.find(num => num > 0);
    if (parentNum === undefined) {
      return undefined;
    }

    current = sys.bodies.find(b => b.num === parentNum);
  }

  return undefined;
};

export const shouldApplyForeignStarAgricultureWeakLink = (
  source: SiteMap2,
  site: SiteMap2,
  homeStarRoot: number | undefined,
  foreignStarAgWeakLinksUsed: Set<number>,
) => {
  if (homeStarRoot === undefined || !shouldLimitForeignStarAgricultureWeakLinks(site)) {
    return true;
  }

  // Odyssey agriculture settlements stack weak links from their host star (IC 1805 Spansh).
  if (source.type.buildClass === "settlement" && source.type.inf === "agriculture") {
    return true;
  }

  const sourceStarRoot = getBodyStarRoot(site.sys, source.body);
  if (sourceStarRoot === undefined || sourceStarRoot === homeStarRoot) {
    return true;
  }

  if (foreignStarAgWeakLinksUsed.has(sourceStarRoot)) {
    return false;
  }

  foreignStarAgWeakLinksUsed.add(sourceStarRoot);
  return true;
};

export const isAgPrimaryHabWorldColony = (site: SiteMap2, map: EconomyMap) => {
  return !!(
    site.intrinsic?.includes('agriculture') &&
    matches([BT.elw, BT.ww], site.body?.type) &&
    map.agriculture >= 1.0 &&
    site.agEconomyCalc?.tier1ColonyAgStrongLink
  );
};

interface AgWeakLinkBudgetContext {
  site: SiteMap2;
  agPrimaryHabWorld: boolean;
}

interface AgWeakLinkBudgetRule {
  label: string;
  budget: number | ((ctx: AgWeakLinkBudgetContext) => number);
  when: (ctx: AgWeakLinkBudgetContext) => boolean;
}

const resolveAgWeakLinkRuleBudget = (rule: AgWeakLinkBudgetRule, ctx: AgWeakLinkBudgetContext): number =>
  typeof rule.budget === "function" ? rule.budget(ctx) : rule.budget;

const AG_WEAK_LINK_BUDGET_RULES: AgWeakLinkBudgetRule[] = [
  {
    label: 'ELW/WW ag-primary hab colony with T1 colony ag strong link',
    budget: AG_WEAK_LINK_BUDGET.HAB_WORLD_T1_COLONY,
    when: ({ agPrimaryHabWorld }) => agPrimaryHabWorld,
  },
  {
    label: 'Icy fixed non-ag port with organics or tidal penalty',
    budget: AG_WEAK_LINK_BUDGET.ICY_FIXED,
    when: ({ site }) =>
      !!site.type.fixed &&
      site.type.fixed !== 'agriculture' &&
      matches([BT.ib, BT.ri], site.body?.type) &&
      (
        matches([BodyFeature.bio], site.body?.features) ||
        bodyIsTidalToStar(site.sys, site.body)
      ),
  },
  {
    label: 'HMC/MRB surface outpost without agriculture intrinsic',
    budget: AG_WEAK_LINK_BUDGET.HMC_OUTPOST,
    when: ({ site }) =>
      site.type.buildClass === 'outpost' &&
      site.type.inf === 'colony' &&
      !site.type.fixed &&
      !site.intrinsic?.includes('agriculture') &&
      matches([BT.hmc, BT.mrb], site.body?.type),
  },
  {
    label: 'HMC/MRB colony starport without same-body agriculture strong link',
    budget: AG_WEAK_LINK_BUDGET.HMC_STARPORT,
    when: ({ site }) =>
      site.type.buildClass === 'starport' &&
      site.type.inf === 'colony' &&
      !site.type.fixed &&
      !site.intrinsic?.includes('agriculture') &&
      matches([BT.hmc, BT.mrb], site.body?.type) &&
      !site.agEconomyCalc?.sameBodyAgFacilityStrongLink &&
      !site.agEconomyCalc?.sameBodyAgSettlementStrongLink,
  },
  {
    label: 'Same-body large agriculture settlement strong link',
    budget: AG_WEAK_LINK_BUDGET.SAME_BODY_SETTLEMENT,
    when: ({ site }) => !!site.agEconomyCalc?.sameBodyAgSettlementStrongLink,
  },
  {
    label: 'Same-body agriculture facility strong link',
    budget: AG_WEAK_LINK_BUDGET.SAME_BODY_FACILITY,
    when: ({ site }) =>
      !!site.agEconomyCalc?.sameBodyAgFacilityStrongLink &&
      !site.agEconomyCalc?.sameBodyAgSettlementStrongLink,
  },
  {
    label: 'Orbital cluster colony port weak-link budget by subordinate count (plutus / vulcan / prometheus)',
    budget: ({ site }) => getOrbitalClusterAgWeakLinkBudget(site),
    when: ({ site }) =>
      isColonyPortWithoutSameBodyAgStrong(site) &&
      usesOrbitalClusterWeakLinkBudget(site),
  },
  {
    label: 'Spansh-observed colony port weak-link budget by buildType',
    budget: ({ site }) => AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE[site.buildType],
    when: ({ site }) =>
      isColonyPortWithoutSameBodyAgStrong(site) &&
      hasObservedBuildTypeWeakLinkBudget(site),
  },
  {
    label: 'Colony port without same-body agriculture strong link',
    budget: AG_WEAK_LINK_BUDGET.DEFAULT,
    when: ({ site }) =>
      isColonyPortWithoutSameBodyAgStrong(site) &&
      !hasObservedBuildTypeWeakLinkBudget(site) &&
      !usesOrbitalClusterWeakLinkBudget(site) &&
      !matches([BT.hmc, BT.mrb], site.body?.type),
  },
  {
    label: 'Same-body colony agriculture strong link (non-hab world)',
    budget: AG_WEAK_LINK_BUDGET.NON_HAB_COLONY_STRONG,
    when: ({ site, agPrimaryHabWorld }) =>
      !!site.agEconomyCalc?.sameBodyColonyAgStrongLink &&
      !agPrimaryHabWorld &&
      !matches([BT.elw, BT.ww], site.body?.type),
  },
  {
    label: 'Tidal hab-world ag colony',
    budget: AG_WEAK_LINK_BUDGET.TIDAL_HAB,
    when: ({ site }) =>
      !!site.intrinsic?.includes('agriculture') &&
      matches([BT.elw, BT.ww], site.body?.type) &&
      bodyIsTidalToStar(site.sys, site.body),
  },
];

/** Minimum agriculture economy strength contributed via weak links (game-facing % / 100). */
export const getMaxAgricultureWeakLinkBudget = (site: SiteMap2, agPrimaryHabWorld: boolean): number => {
  const ctx: AgWeakLinkBudgetContext = { site, agPrimaryHabWorld };
  let budget = Number.POSITIVE_INFINITY;

  for (const rule of AG_WEAK_LINK_BUDGET_RULES) {
    if (!rule.when(ctx)) {
      continue;
    }

    const ruleBudget = resolveAgWeakLinkRuleBudget(rule, ctx);
    budget = Math.min(budget, ruleBudget);
  }

  return budget;
};

/** Derived max weak-link source count from the tightest matching budget rule. */
export const getMaxAgricultureWeakLinks = (site: SiteMap2, agPrimaryHabWorld: boolean): number => {
  const budget = getMaxAgricultureWeakLinkBudget(site, agPrimaryHabWorld);
  if (!Number.isFinite(budget)) {
    return Number.POSITIVE_INFINITY;
  }
  return weakLinkBudgetToMaxSources(budget);
};

/** Diagnostics: which budget rules match and the tightest budget selected. */
export const explainAgricultureWeakLinkBudget = (site: SiteMap2, agPrimaryHabWorld: boolean) => {
  const ctx: AgWeakLinkBudgetContext = { site, agPrimaryHabWorld };
  const matching = AG_WEAK_LINK_BUDGET_RULES.filter(rule => rule.when(ctx));
  const budget = getMaxAgricultureWeakLinkBudget(site, agPrimaryHabWorld);
  return {
    budget,
    maxSources: getMaxAgricultureWeakLinks(site, agPrimaryHabWorld),
    matchingRules: matching.map(rule => ({
      label: rule.label,
      budget: resolveAgWeakLinkRuleBudget(rule, ctx),
    })),
  };
};

/** Spansh-implied weak-link budget after strong links (diagnostics only). */
export const getImpliedAgricultureWeakLinkBudget = (spanshPct: number, agricultureBeforeWeakLinks: number): number => {
  const spansh = spanshPct / 100;
  return Math.max(0, Math.round((spansh - agricultureBeforeWeakLinks) * 100) / 100);
};

export const applyFixedSurfaceAgricultureFloor = (map: EconomyMap, site: SiteMap2) => {
  if (
    !site.type.fixed ||
    site.type.fixed !== 'industrial' ||
    site.type.orbital ||
    matches([BT.ib, BT.ri, BT.elw, BT.ww], site.body?.type) ||
    map.agriculture < 0.55 ||
    map.agriculture >= 1.0
  ) {
    return;
  }

  adjust(
    'agriculture',
    1.0 - map.agriculture,
    'Floor: surface specialised port agriculture minimum',
    map,
    site,
  );
};

export const applyOrbitalFixedNonAgAgricultureFloor = (map: EconomyMap, site: SiteMap2) => {
  if (
    !site.type.fixed ||
    site.type.fixed === 'agriculture' ||
    !site.type.orbital ||
    matches([BT.ib, BT.ri], site.body?.type) ||
    map.agriculture < 0.55 ||
    map.agriculture >= 0.65
  ) {
    return;
  }

  adjust(
    'agriculture',
    0.65 - map.agriculture,
    'Floor: orbital specialised port agriculture minimum',
    map,
    site,
  );
};

export const getForeignStarAgricultureWeakLinkRoot = (site: SiteMap2) => {
  return shouldLimitForeignStarAgricultureWeakLinks(site)
    ? getBodyStarRoot(site.sys, site.body)
    : undefined;
};

export const applyAgricultureSettlementFloor = (map: EconomyMap, site: SiteMap2) => {
  if (
    site.type.buildClass !== "settlement" ||
    site.type.inf !== "agriculture" ||
    !TIER1_AGRICULTURE_SETTLEMENT_BUILD_TYPES.has(site.buildType) ||
    map.agriculture <= 0
  ) {
    return;
  }

  const floor = getAgricultureSettlementFloorValue(site);
  if (map.agriculture >= floor) {
    return;
  }

  adjust(
    "agriculture",
    floor - map.agriculture,
    "Floor: agriculture settlement minimum",
    map,
    site,
  );
};
