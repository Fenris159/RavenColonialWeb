import * as fs from "fs";
import * as path from "path";
import { buildSystemModel2, SysMap2 } from "../../../src/economy/system-model2";
import { Site, Sys } from "../../../src/types2";

type SiteSnapshot = {
  id: string;
  name: string;
  buildType: string;
  status: string;
  bodyNum: number;
  primaryEconomy?: string;
  economies?: Record<string, number>;
  links?: {
    strong: string[];
    weak: string[];
    sameBodyWeak: string[];
  };
  calcNeeds?: { tier: number; count: number };
};

const fixtureDir = path.join(process.cwd(), "local", "economy", "fixtures", "systems", "hip52675");

const cloneSys = (sys: Sys): Sys => JSON.parse(JSON.stringify(sys));

const snapshotModel = (map: SysMap2): SiteSnapshot[] =>
  map.siteMaps.map(site => ({
    id: site.id,
    name: site.name,
    buildType: site.buildType,
    status: site.status,
    bodyNum: site.bodyNum ?? -1,
    primaryEconomy: site.primaryEconomy,
    economies: site.economies
      ? Object.fromEntries(Object.entries(site.economies).sort(([a], [b]) => a.localeCompare(b)))
      : undefined,
    links: site.links
      ? {
        strong: site.links.strongSites.map(s => s.id).sort(),
        weak: site.links.weakSites.map(s => s.id).sort(),
        sameBodyWeak: site.links.sameBodyWeakSites?.map(s => s.id).sort() ?? [],
      }
      : undefined,
    calcNeeds: site.calcNeeds,
  }));

const bodyGroupSignature = (site: Site, baseline: SysMap2): string => {
  const siteMap = baseline.siteMaps.find(s => s.id === site.id);
  if (!siteMap) return `missing:${site.id}`;
  return `body:${siteMap.body?.name ?? site.bodyNum ?? "unknown"}`;
};

const getGroupSortKey = (sites: Site[], originalIndex: Map<string, number>): number =>
  Math.min(...sites.map(s => originalIndex.get(s.id) ?? Number.MAX_SAFE_INTEGER));

const groupedOrderMaintainingPrimaries = (sys: Sys, baseline: SysMap2, preserveTaxOrderWithinBody = false): string[] => {
  const cutoff = sys.idxCalcLimit ?? sys.sites.length;
  const aboveCutoff = sys.sites.slice(0, cutoff);
  const belowCutoff = sys.sites.slice(cutoff);
  const originalIndex = new Map(sys.sites.map((site, index) => [site.id, index]));
  const taxRank = new Map<string, number>();
  baseline.siteMaps
    .filter(site =>
      site.status !== "demolish" &&
      baseline.calcIds.includes(site.id) &&
      site.id !== baseline.primaryPortId &&
      site.type.buildClass === "starport" &&
      site.type.tier > 1,
    )
    .forEach((site, index) => taxRank.set(site.id, index));
  const groupMap = new Map<string, Site[]>();

  for (const site of aboveCutoff) {
    const signature = bodyGroupSignature(site, baseline);
    const current = groupMap.get(signature) ?? [];
    current.push(site);
    groupMap.set(signature, current);
  }

  const groups = Array.from(groupMap.values())
    .sort((a, b) => {
      const taxA = a.some(s => s.id === baseline.primaryPortId)
        ? -1
        : Math.min(...a.map(s => taxRank.get(s.id) ?? Number.MAX_SAFE_INTEGER));
      const taxB = b.some(s => s.id === baseline.primaryPortId)
        ? -1
        : Math.min(...b.map(s => taxRank.get(s.id) ?? Number.MAX_SAFE_INTEGER));
      if (taxA !== taxB) return taxA - taxB;
      return getGroupSortKey(a, originalIndex) - getGroupSortKey(b, originalIndex);
    });

  const grouped = groups.flatMap(group =>
    [...group].sort((a, b) => {
      const am = baseline.siteMaps.find(s => s.id === a.id);
      const bm = baseline.siteMaps.find(s => s.id === b.id);
      const primaryRank = (site: Site): number => {
        const map = baseline.siteMaps.find(s => s.id === site.id);
        if (baseline.primaryPortId === site.id) return -1;
        if (map?.body?.orbitalPrimary?.id === site.id) return 0;
        if (map?.body?.surfacePrimary?.id === site.id) return 2;
        return map?.type.orbital ? 1 : 3;
      };
      const aPrimaryRank = primaryRank(a);
      const bPrimaryRank = primaryRank(b);
      const aTaxRank = taxRank.get(a.id);
      const bTaxRank = taxRank.get(b.id);
      if (preserveTaxOrderWithinBody && aTaxRank !== undefined && bTaxRank !== undefined && aTaxRank !== bTaxRank) {
        return aTaxRank - bTaxRank;
      }
      if (aPrimaryRank !== bPrimaryRank) return aPrimaryRank - bPrimaryRank;
      const aOrbital = am?.type.orbital ? 0 : 1;
      const bOrbital = bm?.type.orbital ? 0 : 1;
      if (aOrbital !== bOrbital) return aOrbital - bOrbital;
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    }),
  );

  return [
    ...grouped.map(s => s.id),
    ...belowCutoff.map(s => s.id),
  ];
};

const diffSnapshots = (baseline: SiteSnapshot[], grouped: SiteSnapshot[]) => {
  const groupedById = new Map(grouped.map(s => [s.id, s]));
  return baseline.flatMap(site => {
    const match = groupedById.get(site.id);
    if (!match) return [{ id: site.id, name: site.name, field: "missing", before: site, after: undefined }];

    const diffs: Array<{ id: string; name: string; field: string; before: unknown; after: unknown }> = [];
    for (const field of ["primaryEconomy", "economies", "links", "calcNeeds"] as const) {
      const before = JSON.stringify(site[field] ?? null);
      const after = JSON.stringify(match[field] ?? null);
      if (before !== after) {
        diffs.push({ id: site.id, name: site.name, field, before: site[field] ?? null, after: match[field] ?? null });
      }
    }
    return diffs;
  });
};

const bodyPrimarySnapshot = (map: SysMap2) =>
  Object.values(map.bodyMap)
    .map(body => ({
      body: body.name,
      surfacePrimary: body.surfacePrimary?.id,
      orbitalPrimary: body.orbitalPrimary?.id,
    }))
    .sort((a, b) => a.body.localeCompare(b.body));

describe("HIP 52675 grouping experiment", () => {
  it("captures current results and compares grouped body-link order", () => {
    const sys = JSON.parse(fs.readFileSync(path.join(fixtureDir, "rc-sys.json"), "utf8")) as Sys;
    const baseline = buildSystemModel2(cloneSys(sys), true, undefined, {
      enableTerraformableAgricultureBonus: true,
    });
    const baselineSnapshot = snapshotModel(baseline);

    const nextOrder = groupedOrderMaintainingPrimaries(sys, baseline);
    const groupedSys = cloneSys(sys);
    groupedSys.sites = nextOrder.map(id => groupedSys.sites.find(s => s.id === id)!);
    const grouped = buildSystemModel2(groupedSys, true, undefined, {
      enableTerraformableAgricultureBonus: true,
    });
    const groupedSnapshot = snapshotModel(grouped);
    const diffs = diffSnapshots(baselineSnapshot, groupedSnapshot);
    const baselineBodyPrimaries = bodyPrimarySnapshot(baseline);
    const groupedBodyPrimaries = bodyPrimarySnapshot(grouped);
    const bodyPrimaryDiffs = baselineBodyPrimaries.filter((body, index) =>
      JSON.stringify(body) !== JSON.stringify(groupedBodyPrimaries[index]),
    );
    const strictOrder = groupedOrderMaintainingPrimaries(sys, baseline, true);
    const strictSys = cloneSys(sys);
    strictSys.sites = strictOrder.map(id => strictSys.sites.find(s => s.id === id)!);
    const strictGrouped = buildSystemModel2(strictSys, true, undefined, {
      enableTerraformableAgricultureBonus: true,
    });
    const strictDiffs = diffSnapshots(baselineSnapshot, snapshotModel(strictGrouped));
    const strictBodyPrimaries = bodyPrimarySnapshot(strictGrouped);
    const strictBodyPrimaryDiffs = baselineBodyPrimaries.filter((body, index) =>
      JSON.stringify(body) !== JSON.stringify(strictBodyPrimaries[index]),
    );

    fs.writeFileSync(path.join(fixtureDir, "grouping-baseline-snapshot.tmp.json"), JSON.stringify(baselineSnapshot, null, 2));
    fs.writeFileSync(path.join(fixtureDir, "grouping-order.tmp.json"), JSON.stringify(nextOrder, null, 2));
    fs.writeFileSync(path.join(fixtureDir, "grouping-diffs.tmp.json"), JSON.stringify(diffs, null, 2));
    fs.writeFileSync(path.join(fixtureDir, "grouping-body-primary-diffs.tmp.json"), JSON.stringify(bodyPrimaryDiffs, null, 2));
    fs.writeFileSync(path.join(fixtureDir, "grouping-order-tax-strict.tmp.json"), JSON.stringify(strictOrder, null, 2));
    fs.writeFileSync(path.join(fixtureDir, "grouping-diffs-tax-strict.tmp.json"), JSON.stringify(strictDiffs, null, 2));

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      siteCount: sys.sites.length,
      cutoff: sys.idxCalcLimit,
      movedSites: nextOrder.filter((id, index) => sys.sites[index]?.id !== id).length,
      diffCount: diffs.length,
      bodyPrimaryDiffCount: bodyPrimaryDiffs.length,
      taxStrict: {
        movedSites: strictOrder.filter((id, index) => sys.sites[index]?.id !== id).length,
        diffCount: strictDiffs.length,
        bodyPrimaryDiffCount: strictBodyPrimaryDiffs.length,
        firstDiffs: strictDiffs.slice(0, 10).map(d => ({ id: d.id, name: d.name, field: d.field })),
      },
      firstDiffs: diffs.slice(0, 10).map(d => ({ id: d.id, name: d.name, field: d.field })),
    }, null, 2));

    expect(nextOrder).toHaveLength(sys.sites.length);
    expect(new Set(nextOrder).size).toBe(sys.sites.length);
    expect(bodyPrimaryDiffs).toHaveLength(0);
    expect(diffs).toHaveLength(0);
    expect(strictBodyPrimaryDiffs).toHaveLength(0);
    expect(strictDiffs).toHaveLength(0);
  });
});
