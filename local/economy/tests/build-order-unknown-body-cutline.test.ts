import * as fs from "fs";
import * as path from "path";
import { buildSystemModel2, SiteMap2, sumTierPoints } from "../../../src/economy/system-model2";
import {
  getActivePrimaryId,
  groupAllSitesByBodyWithPlansLast,
  groupCompletedSitesByBody,
  groupSitesByActiveCut,
  isBelowCutLineOnly,
} from "../../../src/views/SystemView2/build-order-sort";
import { Sys } from "../../../src/types2";

const loadHipSystem = (): Sys => {
  const livePath = path.join(process.env.TEMP ?? "", "current-hip52675.json");
  const fixturePath = path.join(process.cwd(), "local", "economy", "fixtures", "systems", "hip52675", "rc-sys.json");
  const sys = JSON.parse(fs.readFileSync(fs.existsSync(livePath) ? livePath : fixturePath, "utf8")) as Sys;

  if (!sys.sites.some(site => site.name === "Rivera's Pride")) {
    sys.sites.unshift({
      id: "bad-unknown",
      buildId: "bad-unknown",
      marketId: undefined as any,
      name: "Rivera's Pride",
      bodyNum: -1,
      buildType: "no_truss",
      status: "build",
    });
  }

  return sys;
};

const mapSites = (sites: SiteMap2[]) =>
  sites.reduce((map, site) => {
    map[site.id] = site;
    return map;
  }, {} as Record<string, SiteMap2>);

const calcIdsFromCut = (map: Record<string, SiteMap2>, sortedIDs: string[], cutoffIdx: number) =>
  sortedIDs.filter((id, i) => i < cutoffIdx && !isBelowCutLineOnly(map[id]));

describe("Build order unknown-body cutline handling", () => {
  it("keeps unknown-body rows below the cut line and uses the first valid completed port as primary", () => {
    const sysMap = buildSystemModel2(loadHipSystem(), false, true);
    const map = mapSites(sysMap.siteMaps);
    const singleDigitMarketIdSite = {
      ...sysMap.siteMaps.find(site => site.name === "Escobar Gateway")!,
      id: "single-digit-market-id",
      marketId: 7,
      name: "Single Digit Market ID",
    } as SiteMap2;
    map[singleDigitMarketIdSite.id] = singleDigitMarketIdSite;
    const orderIDs = sysMap.sites.map(site => site.id);
    orderIDs.push(singleDigitMarketIdSite.id);
    const unknown = sysMap.siteMaps.find(site => site.name === "Rivera's Pride")!;
    const nullBuildTypeSite = sysMap.siteMaps.find(site => site.name === "Galitzki Metallurgic Hub") ?? ({
      id: "null-build-type",
      name: "Null Build Type",
      bodyNum: 1,
      buildType: null,
      status: "complete",
      body: { num: 1, name: "HIP 52675 13 a" },
    } as unknown as SiteMap2);
    const escobar = sysMap.siteMaps.find(site => site.name === "Escobar Gateway")!;

    const completeOnly = groupCompletedSitesByBody(map, orderIDs);
    const allSites = groupAllSitesByBodyWithPlansLast(map, orderIDs);
    const activeCut = groupSitesByActiveCut(map, orderIDs, sysMap.calcIds);

    expect(isBelowCutLineOnly(unknown)).toBe(true);
    expect(isBelowCutLineOnly(nullBuildTypeSite)).toBe(true);
    expect(isBelowCutLineOnly(singleDigitMarketIdSite)).toBe(true);
    expect(getActivePrimaryId(map, orderIDs)).toBe(escobar.id);
    expect(completeOnly.cutoffIdx).toBeGreaterThan(0);
    expect(completeOnly.sortedIDs.indexOf(unknown.id)).toBeGreaterThanOrEqual(completeOnly.cutoffIdx);
    if (nullBuildTypeSite.id in map) {
      expect(completeOnly.sortedIDs.indexOf(nullBuildTypeSite.id)).toBeGreaterThanOrEqual(completeOnly.cutoffIdx);
    }
    const belowOnlyIDs = allSites.filter(id => isBelowCutLineOnly(map[id]));
    const firstBelowOnlyIdx = allSites.findIndex(id => isBelowCutLineOnly(map[id]));
    expect(firstBelowOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(allSites.slice(firstBelowOnlyIdx)).toEqual(belowOnlyIDs);
    expect(belowOnlyIDs).toContain(unknown.id);
    expect(belowOnlyIDs).toContain(singleDigitMarketIdSite.id);
    if (nullBuildTypeSite.id in map) {
      expect(belowOnlyIDs).toContain(nullBuildTypeSite.id);
    }
    const activeCutBelowOnlyIDs = activeCut.sortedIDs.filter(id => isBelowCutLineOnly(map[id]));
    const activeCutFirstBelowOnlyIdx = activeCut.sortedIDs.findIndex(id => isBelowCutLineOnly(map[id]));
    expect(activeCutFirstBelowOnlyIdx).toBeGreaterThanOrEqual(0);
    expect(activeCut.sortedIDs.slice(activeCutFirstBelowOnlyIdx)).toEqual(activeCutBelowOnlyIDs);
  });

  it("matches system-map tier points for completed-only and use-all initial order views", () => {
    const sys = loadHipSystem();

    for (const useIncomplete of [false, true]) {
      const sysMap = buildSystemModel2(sys, useIncomplete, true);
      const map = mapSites(sysMap.siteMaps);
      const orderIDs = sysMap.sites.map(site => site.id);
      const order = useIncomplete
        ? groupSitesByActiveCut(map, orderIDs, sysMap.calcIds)
        : groupCompletedSitesByBody(map, orderIDs);
      const sortedSiteMaps = order.sortedIDs.map(id => map[id]);
      const calcIds = calcIdsFromCut(map, order.sortedIDs, order.cutoffIdx);
      const primaryId = sysMap.primaryPortId ?? getActivePrimaryId(map, order.sortedIDs);

      const { tierPoints } = sumTierPoints(sortedSiteMaps, calcIds, undefined, primaryId);

      expect(new Set(calcIds)).toEqual(new Set(sysMap.calcIds));
      expect(tierPoints).toEqual(sysMap.tierPoints);
    }
  });

  it("matches the system map when the order panel previews use-all with the cut line at the bottom", () => {
    const baseSysMap = buildSystemModel2(loadHipSystem(), false, true);
    const map = mapSites(baseSysMap.siteMaps);
    const allSites = groupAllSitesByBodyWithPlansLast(map, baseSysMap.sites.map(site => site.id));
    const allCalcIds = allSites.filter(id => {
      const site = map[id];
      return site.status !== "demolish" && !isBelowCutLineOnly(site);
    });
    const primaryId = baseSysMap.primaryPortId ?? getActivePrimaryId(map, allSites);
    const { tierPoints } = sumTierPoints(allSites.map(id => map[id]), allCalcIds, undefined, primaryId);
    const previewSysMap = buildSystemModel2({
      ...baseSysMap,
      sites: allSites.map(id => baseSysMap.sites.find(site => site.id === id)!),
      idxCalcLimit: allSites.length,
    }, true, true);

    expect(new Set(previewSysMap.calcIds)).toEqual(new Set(allCalcIds));
    expect(previewSysMap.tierPoints).toEqual(tierPoints);
  });

  it("does not collapse use-all back to completed-only when planned tier sites exist", () => {
    const sys = loadHipSystem();
    const completedBaseline = buildSystemModel2(sys, false, true);
    const escobar = completedBaseline.siteMaps.find(site => site.name === "Escobar Gateway")!;
    const plannedId = "planned-tier-regression";
    const plannedSite = {
      ...escobar.original,
      id: plannedId,
      buildId: plannedId,
      bodyNum: escobar.bodyNum,
      buildType: "vulcan",
      marketId: 999999999,
      name: "Planned Tier Regression",
      status: "plan" as const,
    };
    const sysWithPlan = {
      ...sys,
      sites: [...sys.sites, plannedSite],
      idxCalcLimit: sys.sites.length + 1,
    };

    const completed = buildSystemModel2(sysWithPlan, false, true);
    const all = buildSystemModel2(sysWithPlan, true, true);

    expect(completed.calcIds).not.toContain(plannedId);
    expect(all.calcIds).toContain(plannedId);
    expect(all.calcIds.length).toBeGreaterThan(completed.calcIds.length);
    expect(all.tierPoints).not.toEqual(completed.tierPoints);
  });

  it("does not force planned asteroid ports with placeholder marketId 0 below BROKEN BELOW", () => {
    const sys = loadHipSystem();
    const completedBaseline = buildSystemModel2(sys, false, true);
    const asteroidBody = completedBaseline.bodies.find(body => body.type === "ac" as any) ?? completedBaseline.bodies[0];
    const plannedId = "planned-asteroid-market-zero";
    const plannedAsteroid = {
      id: plannedId,
      buildId: plannedId,
      bodyNum: asteroidBody.num,
      buildType: "asteroid",
      marketId: 0,
      name: "Planned Asteroid Market Zero",
      status: "plan" as const,
    };
    const sysWithPlan = {
      ...sys,
      sites: [...sys.sites, plannedAsteroid],
      idxCalcLimit: sys.sites.length + 1,
    };

    const sysMap = buildSystemModel2(sysWithPlan, false, true);
    const map = mapSites(sysMap.siteMaps);
    const order = groupCompletedSitesByBody(map, sysMap.sites.map(site => site.id));
    const plannedSite = map[plannedId];
    const plannedIdx = order.sortedIDs.indexOf(plannedId);
    const firstBrokenIdx = order.sortedIDs.findIndex(id => isBelowCutLineOnly(map[id]));

    expect(isBelowCutLineOnly(plannedSite)).toBe(false);
    expect(plannedIdx).toBeGreaterThanOrEqual(order.cutoffIdx);
    if (firstBrokenIdx >= 0) {
      expect(plannedIdx).toBeLessThan(firstBrokenIdx);
    }
  });
});
