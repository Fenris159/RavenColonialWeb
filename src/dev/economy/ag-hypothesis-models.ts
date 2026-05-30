import {
  AG_WEAK_LINK_BUDGET,
  AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE,
  AG_WEAK_LINK_ORBITAL_CLUSTER_BUILD_TYPES,
  WEAK_LINK_AGRICULTURE_DELTA,
  getImpliedAgricultureWeakLinkBudget,
  getOrbitalClusterAgWeakLinkBudget,
  weakLinkBudgetToMaxSources,
} from "../../economy-ag-heuristics";
import { getColonyEconomyBeforeWeakLinks } from "../../economy-model2";
import type { SiteMap2, SysMap2 } from "../../system-model2";
import { Bod, BT } from "../../types2";

export type AgHypothesisScenario =
  | "baseline"
  | "exclusive-nearest"
  | "exclusive-facility"
  | "exclusive-same-body"
  | "exclusive-orbit-match"
  | "exclusive-facility-budget-v2"
  | "port-budget-v1"
  | "port-budget-v2";

export interface AgHypothesisResult {
  marketId: number;
  name: string;
  spanshAg: number;
  baselineAg: number;
  simulatedAg: number;
  strongBeforeWeak: number;
  impliedBudget: number;
  agPool: number;
  assignedPool?: number;
  budgetUsed?: number;
}

const getBodyDistLS = (sys: SysMap2, bodyNum: number | undefined): number => {
  if (bodyNum === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  return sys.bodies.find(b => b.num === bodyNum)?.distLS ?? Number.POSITIVE_INFINITY;
};

const bodyDist = (sys: SysMap2, a: number | undefined, b: number | undefined) =>
  Math.abs(getBodyDistLS(sys, a) - getBodyDistLS(sys, b));

const isPrimaryPort = (site: SiteMap2) =>
  site === site.body?.orbitalPrimary || site === site.body?.surfacePrimary;

const agWeakSources = (site: SiteMap2) =>
  site.links?.weakSites?.filter(s => s.type.inf === "agriculture") ?? [];

/** Facility-like ag sources only weak-link to one primary; settlements share across primaries. */
const isExclusiveAgFacility = (source: SiteMap2) => {
  if (source.type.buildClass === "settlement") {
    return false;
  }
  if (source.type.inf === "agriculture") {
    return true;
  }
  return source.type.buildClass === "outpost" || source.type.buildClass === "starport";
};

export const assignExclusiveAgSources = (
  sysMap: SysMap2,
  mode: "nearest" | "facility" | "same-body" | "orbit-match",
): Map<string, string> => {
  const primaries = sysMap.siteMaps.filter(s => s.links && isPrimaryPort(s));
  const assignment = new Map<string, string>();

  const primariesOnBody = (bodyNum: number | undefined) =>
    primaries.filter(p => p.bodyNum === bodyNum);

  for (const source of sysMap.siteMaps) {
    if (source.type.inf !== "agriculture" && source.type.buildClass !== "settlement") {
      continue;
    }
    if (!sysMap.calcIds?.includes(source.id)) {
      continue;
    }
    if (isPrimaryPort(source)) {
      continue;
    }

    if (mode === "facility" && !isExclusiveAgFacility(source)) {
      continue;
    }

    let candidatePrimaries = primaries;
    if (mode === "same-body" || mode === "orbit-match") {
      candidatePrimaries = primariesOnBody(source.bodyNum);
      if (candidatePrimaries.length === 0) {
        candidatePrimaries = primaries;
      }
    }

    let bestPrimary = candidatePrimaries[0];
    let bestDist = Number.POSITIVE_INFINITY;
    let bestOrbitalBias = -1;

    if (mode === "orbit-match") {
      const matched = candidatePrimaries.find(p => p.type.orbital === source.type.orbital);
      if (matched) {
        assignment.set(source.id, matched.id);
        continue;
      }
    }

    for (const primary of candidatePrimaries) {
      const d = bodyDist(sysMap, source.bodyNum, primary.bodyNum);
      const orbitalBias = primary.type.orbital ? 1 : 0;
      if (d < bestDist || (d === bestDist && orbitalBias > bestOrbitalBias)) {
        bestDist = d;
        bestPrimary = primary;
        bestOrbitalBias = orbitalBias;
      }
    }

    if (bestPrimary) {
      assignment.set(source.id, bestPrimary.id);
    }
  }

  return assignment;
};

/** Port-type budget rules derived from HR 4464 Spansh regression (hypothesis B). */
export const getHypothesisPortAgBudget = (site: SiteMap2): number => {
  if (site.type.fixed || site.type.inf !== "colony") {
    return Number.POSITIVE_INFINITY;
  }

  if (site.type.buildClass === "starport" && !site.type.orbital) {
    return AG_WEAK_LINK_BUDGET.HMC_STARPORT;
  }

  if (!site.type.orbital && site.type.buildClass === "outpost") {
    return AG_WEAK_LINK_BUDGET.HMC_STARPORT;
  }

  if (site.type.orbital && site.type.buildClass === "outpost") {
    const subs = site.links?.strongSites?.length ?? 0;
    if (subs >= 3) {
      return 1.15;
    }
    if (subs >= 1) {
      return 1.15;
    }
    return AG_WEAK_LINK_BUDGET.DEFAULT;
  }

  return AG_WEAK_LINK_BUDGET.DEFAULT;
};

/** v2: production-aligned port budgets (buildType map + orbital cluster sub tiers). */
export const getHypothesisPortAgBudgetV2 = (site: SiteMap2): number => {
  if (site.type.fixed || site.type.inf !== "colony") {
    return Number.POSITIVE_INFINITY;
  }

  if (AG_WEAK_LINK_ORBITAL_CLUSTER_BUILD_TYPES.has(site.buildType) && site.type.orbital) {
    return getOrbitalClusterAgWeakLinkBudget(site);
  }

  if (site.buildType in AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE) {
    return AG_WEAK_LINK_BUDGET_BY_BUILD_TYPE[site.buildType];
  }

  if (site.type.buildClass === "starport" && !site.type.orbital) {
    return AG_WEAK_LINK_BUDGET.HMC_STARPORT;
  }

  return AG_WEAK_LINK_BUDGET.DEFAULT;
};

const countForeignStarLimited = (site: SiteMap2, sources: SiteMap2[]) => {
  if (site.type.orbital || site.type.fixed || site.type.inf !== "colony" || site.intrinsic?.includes("agriculture")) {
    return sources.length;
  }

  const homeStar = getStarRoot(site.sys, site.body);
  const usedStars = new Set<number>();
  let count = 0;

  for (const source of [...sources].sort((a, b) => a.name.localeCompare(b.name))) {
    const sourceStar = getStarRoot(site.sys, source.body);
    if (sourceStar === undefined || sourceStar === homeStar) {
      count++;
      continue;
    }
    if (usedStars.has(sourceStar)) {
      continue;
    }
    usedStars.add(sourceStar);
    count++;
  }

  return count;
};

const getStarRoot = (sys: SysMap2, body: Bod | undefined) => {
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

export const simulatePortAgriculture = (
  site: SiteMap2,
  scenario: AgHypothesisScenario,
  exclusiveAssignment?: Map<string, string>,
): number => {
  const strongBefore = getColonyEconomyBeforeWeakLinks(site, "agriculture");
  let pool = agWeakSources(site);

  if (
    scenario === "exclusive-nearest" ||
    scenario === "exclusive-facility" ||
    scenario === "exclusive-same-body" ||
    scenario === "exclusive-orbit-match" ||
    scenario === "exclusive-facility-budget-v2"
  ) {
    pool = pool.filter(s => exclusiveAssignment?.get(s.id) === site.id);
  }

  const eligibleCount = countForeignStarLimited(site, pool);

  let budget: number = AG_WEAK_LINK_BUDGET.DEFAULT;
  switch (scenario) {
    case "port-budget-v1":
      budget = getHypothesisPortAgBudget(site);
      break;
    case "port-budget-v2":
    case "exclusive-facility-budget-v2":
      budget = getHypothesisPortAgBudgetV2(site);
      break;
    case "exclusive-nearest":
    case "exclusive-facility":
    case "exclusive-same-body":
    case "exclusive-orbit-match":
      budget = AG_WEAK_LINK_BUDGET.DEFAULT;
      break;
    default:
      budget = AG_WEAK_LINK_BUDGET.DEFAULT;
      break;
  }

  if (!Number.isFinite(budget)) {
    return strongBefore + eligibleCount * WEAK_LINK_AGRICULTURE_DELTA;
  }

  const maxSources = weakLinkBudgetToMaxSources(budget);
  const applied = Math.min(eligibleCount, maxSources);
  return Math.round((strongBefore + applied * WEAK_LINK_AGRICULTURE_DELTA) * 100) / 100;
};

export interface ScenarioScore {
  scenario: AgHypothesisScenario;
  compared: number;
  matches: number;
  mae: number;
  results: AgHypothesisResult[];
}

export const scoreAgHypothesis = (
  sysMap: SysMap2,
  spanshMap: Record<number, { economies?: { agriculture?: number } }>,
  scenario: AgHypothesisScenario,
): ScenarioScore => {
  const exclusiveNearest = assignExclusiveAgSources(sysMap, "nearest");
  const exclusiveFacility = assignExclusiveAgSources(sysMap, "facility");
  const exclusiveSameBody = assignExclusiveAgSources(sysMap, "same-body");
  const exclusiveOrbitMatch = assignExclusiveAgSources(sysMap, "orbit-match");
  const assignment =
    scenario === "exclusive-facility" || scenario === "exclusive-facility-budget-v2"
      ? exclusiveFacility
      : scenario === "exclusive-same-body"
        ? exclusiveSameBody
        : scenario === "exclusive-orbit-match"
          ? exclusiveOrbitMatch
          : scenario === "exclusive-nearest"
            ? exclusiveNearest
            : undefined;

  const results: AgHypothesisResult[] = [];

  for (const site of sysMap.siteMaps) {
    if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.links) {
      continue;
    }
    const spanshAg = spanshMap[site.marketId]?.economies?.agriculture;
    if (typeof spanshAg !== "number") {
      continue;
    }

    const strongBefore = getColonyEconomyBeforeWeakLinks(site, "agriculture");
    const impliedBudget = getImpliedAgricultureWeakLinkBudget(spanshAg, strongBefore);
    const baselineAg = Math.round((site.economies?.agriculture ?? 0) * 100);
    const simulatedRaw =
      scenario === "baseline"
        ? site.economies?.agriculture ?? 0
        : simulatePortAgriculture(site, scenario, assignment);
    const simulatedAg = Math.round(simulatedRaw * 100);

    const pool = agWeakSources(site).length;
    const assignedPool =
      scenario === "exclusive-nearest" ||
      scenario === "exclusive-facility" ||
      scenario === "exclusive-same-body" ||
      scenario === "exclusive-orbit-match" ||
      scenario === "exclusive-facility-budget-v2"
        ? agWeakSources(site).filter(s => assignment?.get(s.id) === site.id).length
        : undefined;

    results.push({
      marketId: site.marketId,
      name: site.name,
      spanshAg,
      baselineAg,
      simulatedAg,
      strongBeforeWeak: Math.round(strongBefore * 100),
      impliedBudget: Math.round(impliedBudget * 100),
      agPool: pool,
      assignedPool,
      budgetUsed:
        scenario === "port-budget-v1"
          ? Math.round(getHypothesisPortAgBudget(site) * 100)
          : scenario === "port-budget-v2"
            ? Math.round(getHypothesisPortAgBudgetV2(site) * 100)
            : undefined,
    });
  }

  let mae = 0;
  let matches = 0;
  for (const r of results) {
    mae += Math.abs(r.simulatedAg - r.spanshAg);
    if (r.simulatedAg === r.spanshAg) {
      matches++;
    }
  }

  return {
    scenario,
    compared: results.length,
    matches,
    mae: results.length ? mae / results.length : 0,
    results,
  };
};

export const compareAgHypothesisScenarios = (
  sysMap: SysMap2,
  spanshMap: Record<number, { economies?: { agriculture?: number } }>,
  scenarios: readonly AgHypothesisScenario[],
) => scenarios.map(s => scoreAgHypothesis(sysMap, spanshMap, s));

export const pickBestAgHypothesis = (scores: ScenarioScore[]): ScenarioScore => {
  return scores.reduce((best, s) =>
    s.matches > best.matches || (s.matches === best.matches && s.mae < best.mae) ? s : best,
  );
};
