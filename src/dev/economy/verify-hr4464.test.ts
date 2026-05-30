import { buildSystemModel2, EconomyMap } from "../../system-model2";
import { Sys } from "../../types2";
import { Economy } from "../../site-data";
import { getImpliedAgricultureWeakLinkBudget, getMaxAgricultureWeakLinkBudget, getMaxAgricultureWeakLinks, explainAgricultureWeakLinkBudget } from "../../economy-ag-heuristics";
import { getColonyEconomyBeforeWeakLinks } from "../../economy-model2";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_ID = "18494801076";
const API = "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2";
const SYSTEM_PATH = path.join(os.tmpdir(), "hr4464-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "hr4464-spansh.json");

interface SpanshEconomy {
  id: number;
  economies: Partial<Record<keyof EconomyMap, number>>;
  updated?: string;
}

const roundPct = (value: number) => Math.round(value * 100);

/** UI link bar score (MarketLinks.tsx): strong×62 + weak×8 per economy — display only in RC today. */
const computeLinkGraphScore = (site: { links?: { economies: Record<string, { strong: number; weak: number }> } }) => {
  if (!site.links?.economies) {
    return { total: 0, byEconomy: {} as Record<string, number> };
  }
  const byEconomy: Record<string, number> = {};
  let total = 0;
  for (const [key, { strong, weak }] of Object.entries(site.links.economies)) {
    const score = strong * 62 + weak * 8;
    byEconomy[key] = score;
    total += score;
  }
  return { total, byEconomy };
};

const economyKeys: (keyof EconomyMap)[] = [
  "agriculture", "extraction", "hightech", "industrial", "military", "refinery", "service", "terraforming", "tourism",
];

describe("HR 4464 economy verification (diagnostic)", () => {
  let sys: Sys;
  let spanshMap: Record<number, SpanshEconomy>;

  beforeAll(async () => {
    if (!fs.existsSync(SYSTEM_PATH)) {
      const resp = await fetch(`${API}/system/${SYSTEM_ID}`);
      fs.writeFileSync(SYSTEM_PATH, await resp.text());
    }
    if (!fs.existsSync(SPANSH_PATH)) {
      const resp = await fetch(`${API}/system/${SYSTEM_ID}/spanshEconomies`);
      fs.writeFileSync(SPANSH_PATH, await resp.text());
    }
    sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry]));
  }, 60000);

  it("reports mismatch breakdown for HR 4464", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    type Row = {
      name: string;
      marketId: number;
      buildType: string;
      typeInf: Economy;
      mismatches: { key: keyof EconomyMap; model: number; spansh: number; diff: number }[];
    };

    const rows: Row[] = [];
    let totalSites = 0;
    let sitesWithSpansh = 0;
    let perfectSites = 0;

    const byEconomy: Record<string, { match: number; mismatch: number }> = {};
    for (const k of economyKeys) {
      byEconomy[k] = { match: 0, mismatch: 0 };
    }

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }
      totalSites++;

      const real = spanshMap[site.marketId];
      if (!real?.economies) {
        continue;
      }
      sitesWithSpansh++;

      const siteMismatches: Row["mismatches"] = [];
      for (const key of economyKeys) {
        const model = roundPct(site.economies[key] ?? 0);
        const spansh = real.economies[key] ?? 0;
        if (model === spansh) {
          byEconomy[key].match++;
        } else {
          byEconomy[key].mismatch++;
          siteMismatches.push({ key, model, spansh, diff: model - spansh });
        }
      }

      if (siteMismatches.length === 0) {
        perfectSites++;
      } else {
        rows.push({
          name: site.name,
          marketId: site.marketId,
          buildType: site.buildType,
          typeInf: site.type.inf,
          mismatches: siteMismatches,
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\n=== HR 4464 (${sys.name}, rev ${sys.rev}) ===`);
    // eslint-disable-next-line no-console
    console.log(`Complete sites: ${totalSites}, with Spansh: ${sitesWithSpansh}, perfect: ${perfectSites}, problem sites: ${rows.length}`);
    // eslint-disable-next-line no-console
    console.log("\nPer-economy cell mismatches (across sites with Spansh):");
    for (const k of economyKeys) {
      const { match, mismatch } = byEconomy[k];
      if (mismatch > 0) {
        // eslint-disable-next-line no-console
        console.log(`  ${k}: ${mismatch} mismatches / ${match + mismatch} compared`);
      }
    }

    const agOnly = rows.filter(r => r.mismatches.length === 1 && r.mismatches[0].key === "agriculture");
    const agIncluded = rows.filter(r => r.mismatches.some(m => m.key === "agriculture"));
    // eslint-disable-next-line no-console
    console.log(`\nAgriculture-only mismatches: ${agOnly.length}`);
    // eslint-disable-next-line no-console
    console.log(`Sites with any agriculture mismatch: ${agIncluded.length}`);

    const diffBuckets: Record<string, number> = {};
    for (const row of agIncluded) {
      const ag = row.mismatches.find(m => m.key === "agriculture")!;
      const bucket = `${ag.diff >= 0 ? "+" : ""}${ag.diff}`;
      diffBuckets[bucket] = (diffBuckets[bucket] ?? 0) + 1;
    }
    // eslint-disable-next-line no-console
    console.log("Agriculture diff buckets:", diffBuckets);

    // Top agriculture mismatches with audit
    agIncluded
      .sort((a, b) => Math.abs(b.mismatches.find(m => m.key === "agriculture")!.diff) - Math.abs(a.mismatches.find(m => m.key === "agriculture")!.diff))
      .slice(0, 20)
      .forEach(row => {
        const ag = row.mismatches.find(m => m.key === "agriculture")!;
        const site = sysMap.siteMaps.find(s => s.marketId === row.marketId);
        // eslint-disable-next-line no-console
        console.log(`\n[AG] ${row.name} (${row.buildType}, inf=${row.typeInf}): model ${ag.model}% vs spansh ${ag.spansh}% (${ag.diff >= 0 ? "+" : ""}${ag.diff})`);
        site?.economyAudit
          ?.filter(e => e.inf === "agriculture")
          .forEach(e => console.log(`    ${e.delta >= 0 ? "+" : ""}${e.delta.toFixed(2)} -> ${e.after.toFixed(2)}: ${e.reason}`));
      });

    // Non-agriculture patterns
    const nonAg = rows.filter(r => r.mismatches.some(m => m.key !== "agriculture"));
    // eslint-disable-next-line no-console
    console.log(`\nSites with non-agriculture mismatches: ${nonAg.length}`);
    const nonAgByKey: Record<string, number> = {};
    for (const row of nonAg) {
      for (const m of row.mismatches.filter(x => x.key !== "agriculture")) {
        nonAgByKey[m.key] = (nonAgByKey[m.key] ?? 0) + 1;
      }
    }
    // eslint-disable-next-line no-console
    console.log("Non-ag economy mismatch counts:", nonAgByKey);

    nonAg.slice(0, 10).forEach(row => {
      // eslint-disable-next-line no-console
      console.log(`\n[OTHER] ${row.name}: ${row.mismatches.map(m => `${m.key} ${m.model}% vs ${m.spansh}% (${m.diff >= 0 ? "+" : ""}${m.diff})`).join("; ")}`);
    });

    expect(sitesWithSpansh).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(25);
  });

  it("summarizes weak-link caps and agriculture source count", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    const agWeakSources = sysMap.siteMaps.filter(
      s => s.status === "complete" && s.type.inf === "agriculture",
    ).length;

    const colonyAgColonySources = sysMap.siteMaps.filter(
      s =>
        s.status === "complete" &&
        s.type.inf === "colony" &&
        s.intrinsic?.includes("agriculture"),
    ).length;

    // eslint-disable-next-line no-console
    console.log(`\nAg weak-link sources: inf=agriculture ${agWeakSources}, colony+ag-intrinsic ${colonyAgColonySources}`);

    const sampleNames = [
      "Romarzs Rusty Refinery Refines Rusty Rocks",
      "Dopey Dank Dose Delivery Dispensary",
      "Weird Wallys Wild Waffle Warehouse",
      "Frids F-ing Fantastic Farming Facility",
    ];

    for (const name of sampleNames) {
      const site = sysMap.siteMaps.find(s => s.name === name);
      if (!site) {
        continue;
      }
      const weakAgCount = site.economyAudit?.filter(
        e => e.inf === "agriculture" && e.reason.includes("weak link"),
      ).length ?? 0;
      const strongAgCount = site.economyAudit?.filter(
        e => e.inf === "agriculture" && e.reason.includes("Strong link"),
      ).length ?? 0;
      const maxWeak = getMaxAgricultureWeakLinkBudget(site, false);
      // eslint-disable-next-line no-console
      console.log(
        `${name}: body=${site.body?.type}, orbital=${site.type.orbital}, weak=${weakAgCount}, strong=${strongAgCount}, weakBudget=${Math.round(maxWeak * 100)}%, modelAg=${roundPct(site.economies?.agriculture ?? 0)}%, spansh=${spanshMap[site.marketId]?.economies?.agriculture ?? "?"}%`,
      );
    }

    const romarzs = sysMap.siteMaps.find(s => s.name === "Romarzs Rusty Refinery Refines Rusty Rocks");
    const dopey = sysMap.siteMaps.find(s => s.name === "Dopey Dank Dose Delivery Dispensary");
    const frids = sysMap.siteMaps.find(s => s.name === "Frids F-ing Fantastic Farming Facility");
    const ninjs = sysMap.siteMaps.find(s => s.name === "Ninjs Nasty Noxious Neighborhood Natatorium");
    expect(roundPct(romarzs!.economies!.agriculture!)).toBe(90);
    expect(roundPct(dopey!.economies!.agriculture!)).toBe(310);
    expect(roundPct(frids!.economies!.agriculture!)).toBe(100);
    expect(roundPct(ninjs!.economies!.agriculture!)).toBeGreaterThanOrEqual(265);
    expect(roundPct(ninjs!.economies!.agriculture!)).toBeLessThanOrEqual(270);

    expect(agWeakSources).toBeGreaterThan(0);
  });

  it("inspects strong link wiring for same-body agriculture cases", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    for (const name of [
      "Ninjs Nasty Noxious Neighborhood Natatorium",
      "Dopey Dank Dose Delivery Dispensary",
    ]) {
      const site = sysMap.siteMaps.find(s => s.name === name);
      if (!site) {
        continue;
      }
      const agStrong = site.economyAudit?.filter(e => e.inf === "agriculture" && e.reason.includes("Strong")) ?? [];
      const agWeak = site.economyAudit?.filter(e => e.inf === "agriculture" && e.reason.includes("weak")) ?? [];
      // eslint-disable-next-line no-console
      console.log(
        `\n${name}: strongSites=${site.links?.strongSites?.length ?? 0} weakSites=${site.links?.weakSites?.length ?? 0} agStrong=${agStrong.length} agWeak=${agWeak.length} total=${roundPct(site.economies?.agriculture ?? 0)}%`,
      );
      site.links?.strongSites?.forEach(s => console.log(`  strong: ${s.buildType} ${s.name.slice(0, 40)} parent=${!!s.parentLink}`));
      agStrong.forEach(e => console.log(`  audit: +${e.delta} ${e.reason.slice(0, 70)}`));
    }

    expect(true).toBe(true);
  });

  it("investigates link graph scope vs Spansh-implied weak budgets on HR 4464 B", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    const portNames = [
      "Romarzs Rusty Refinery Refines Rusty Rocks",
      "Romarzs Refinery Recycles Rusty Rubbish",
      "Marvelous Merchant Market Module Mooring",
    ];

    // eslint-disable-next-line no-console
    console.log("\n=== Link graph vs Spansh-implied weak budgets (HR 4464 B rb plutus) ===");

    for (const name of portNames) {
      const site = sysMap.siteMaps.find(s => s.name === name);
      if (!site) {
        continue;
      }

      const spanshAg = spanshMap[site.marketId]?.economies?.agriculture ?? 0;
      const strongBeforeWeak = getColonyEconomyBeforeWeakLinks(site, "agriculture");
      const impliedBudget = getImpliedAgricultureWeakLinkBudget(spanshAg, strongBeforeWeak);
      const modelBudget = getMaxAgricultureWeakLinkBudget(site, false);
      const linkGraphAgWeak = site.links?.economies?.agriculture?.weak ?? 0;
      const linkGraphAgStrong = site.links?.economies?.agriculture?.strong ?? 0;
      const { total: linkGraphScore, byEconomy: linkGraphByEconomy } = computeLinkGraphScore(site);
      const agCandidates = site.links?.weakSites?.filter(s => s.type.inf === "agriculture").length ?? 0;
      const agApplied = site.economyAudit?.filter(e => e.inf === "agriculture" && e.reason.startsWith("Apply weak link")).length ?? 0;
      const impliedWeakLinks = Math.round(impliedBudget / 0.05);

      // eslint-disable-next-line no-console
      console.log(
        `${name.slice(0, 40)}: spansh=${spanshAg}% strongBeforeWeak=${Math.round(strongBeforeWeak * 100)}% impliedBudget=${Math.round(impliedBudget * 100)}% (${impliedWeakLinks} links) modelBudget=${Math.round(modelBudget * 100)}% linkGraphScore=${linkGraphScore} agScore=${linkGraphAgStrong * 62 + linkGraphAgWeak * 8} agWeak=${linkGraphAgWeak} candidates=${agCandidates} applied=${agApplied} strongSubs=${site.links?.strongSites?.length ?? 0}`,
      );
      // eslint-disable-next-line no-console
      console.log(`  linkGraphByEconomy: ${JSON.stringify(linkGraphByEconomy)}`);
      // eslint-disable-next-line no-console
      console.log(`  type: buildClass=${site.type.buildClass} inf=${site.type.inf} fixed=${site.type.fixed} orbital=${site.type.orbital}`);
      // eslint-disable-next-line no-console
      console.log(`  budgetRules: ${JSON.stringify(explainAgricultureWeakLinkBudget(site, false))}`);
      site.links?.strongSites?.forEach(s => {
        // eslint-disable-next-line no-console
        console.log(`  sub: ${s.buildType} inf=${s.type.inf} name=${s.name.slice(0, 50)}`);
      });
    }

    const rusty = sysMap.siteMaps.find(s => s.name === portNames[0])!;
    const recycles = sysMap.siteMaps.find(s => s.name === portNames[1])!;
    const marvelous = sysMap.siteMaps.find(s => s.name === portNames[2])!;

    // Same candidate pool (system-wide link graph), different Spansh-implied budgets.
    expect(rusty.links?.weakSites?.filter(s => s.type.inf === "agriculture").length).toBe(
      recycles.links?.weakSites?.filter(s => s.type.inf === "agriculture").length,
    );
    expect(getImpliedAgricultureWeakLinkBudget(
      spanshMap[rusty.marketId]?.economies?.agriculture ?? 0,
      getColonyEconomyBeforeWeakLinks(rusty, "agriculture"),
    )).toBe(0.9);
    expect(getImpliedAgricultureWeakLinkBudget(
      spanshMap[recycles.marketId]?.economies?.agriculture ?? 0,
      getColonyEconomyBeforeWeakLinks(recycles, "agriculture"),
    )).toBe(1.15);
    expect(getImpliedAgricultureWeakLinkBudget(
      spanshMap[marvelous.marketId]?.economies?.agriculture ?? 0,
      getColonyEconomyBeforeWeakLinks(marvelous, "agriculture"),
    )).toBe(1.4);
    expect(getMaxAgricultureWeakLinkBudget(rusty, false)).toBe(0.9);
    expect(roundPct(rusty.economies!.agriculture!)).toBe(90);
    expect(roundPct(recycles.economies!.agriculture!)).toBe(90);
    expect(roundPct(marvelous.economies!.agriculture!)).toBe(90);

    // Link graph score (strong×62 + weak×8) is UI bar width only — not used in economy calc.
    // RC counts every weak candidate in weakSites; in-game / Spansh reflect player-linked subset counts.
    const rustyScore = computeLinkGraphScore(rusty);
    const recyclesScore = computeLinkGraphScore(recycles);
    const marvelousScore = computeLinkGraphScore(marvelous);
    expect(rustyScore.byEconomy.agriculture).toBe(35 * 8);
    expect(recyclesScore.byEconomy.agriculture).toBe(35 * 8);
    expect(marvelousScore.byEconomy.agriculture).toBe(35 * 8);

    const spanshImpliedAgWeakLinks = (site: typeof rusty) =>
      Math.round(getImpliedAgricultureWeakLinkBudget(
        spanshMap[site.marketId]?.economies?.agriculture ?? 0,
        getColonyEconomyBeforeWeakLinks(site, "agriculture"),
      ) / 0.05);

    expect(spanshImpliedAgWeakLinks(rusty)).toBe(18);
    expect(spanshImpliedAgWeakLinks(recycles)).toBe(23);
    expect(spanshImpliedAgWeakLinks(marvelous)).toBe(28);
    // Spansh-implied linked weak score (×8) differs; total link graph score does not track Spansh ag.
    expect(spanshImpliedAgWeakLinks(rusty) * 8).toBe(144);
    expect(spanshImpliedAgWeakLinks(recycles) * 8).toBe(184);
    expect(spanshImpliedAgWeakLinks(marvelous) * 8).toBe(224);
    expect(recyclesScore.total).toBeGreaterThan(rustyScore.total);
    expect(marvelousScore.total).toBeGreaterThan(rustyScore.total);
    expect(marvelousScore.total).toBeLessThan(recyclesScore.total);
  });

  it("surveys save/API data and Spansh-implied weak budgets across HR 4464 agriculture mismatches", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    type SurveyRow = {
      name: string;
      spanshAg: number;
      modelAg: number;
      impliedBudget: number;
      modelBudget: number;
      strongSubs: number;
      linkGraphScore: number;
      agLinkScore: number;
      strongByEco: Record<string, number>;
    };

    const rows: SurveyRow[] = [];

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }
      const sp = spanshMap[site.marketId];
      if (typeof sp?.economies?.agriculture === "undefined") {
        continue;
      }

      const spanshAg = sp.economies.agriculture;
      const modelAg = roundPct(site.economies.agriculture ?? 0);
      if (spanshAg === modelAg) {
        continue;
      }

      const strongBefore = getColonyEconomyBeforeWeakLinks(site, "agriculture");
      const impliedBudget = getImpliedAgricultureWeakLinkBudget(spanshAg, strongBefore);
      const modelBudget = getMaxAgricultureWeakLinkBudget(site, false);
      const { total: linkGraphScore, byEconomy } = computeLinkGraphScore(site);
      const agLinkScore = (site.links?.economies?.agriculture?.strong ?? 0) * 62
        + (site.links?.economies?.agriculture?.weak ?? 0) * 8;
      const strongByEco: Record<string, number> = {};
      for (const [eco, score] of Object.entries(byEconomy)) {
        const strong = site.links?.economies?.[eco as keyof typeof site.links.economies]?.strong ?? 0;
        if (strong > 0) {
          strongByEco[eco] = strong;
        }
      }

      rows.push({
        name: site.name,
        spanshAg,
        modelAg,
        impliedBudget: Math.round(impliedBudget * 100),
        modelBudget: Math.round(modelBudget * 100),
        strongSubs: site.links?.strongSites?.length ?? 0,
        linkGraphScore,
        agLinkScore,
        strongByEco,
      });
    }

    rows.sort((a, b) => Math.abs(b.spanshAg - b.modelAg) - Math.abs(a.spanshAg - a.modelAg));

    // eslint-disable-next-line no-console
    console.log("\n=== HR 4464 agriculture mismatch survey (save has no per-port link fields) ===");
    for (const row of rows.slice(0, 25)) {
      // eslint-disable-next-line no-console
      console.log(
        `${row.name.slice(0, 42)}: spansh=${row.spanshAg}% model=${row.modelAg}% impliedBudget=${row.impliedBudget}% modelBudget=${row.modelBudget}% subs=${row.strongSubs} strongEco=${JSON.stringify(row.strongByEco)}`,
      );
    }

    // Save/API v6 sites only expose id, name, bodyNum, buildType, status, buildId, marketId — no linked-facility ids.
    const sampleSite = sys.sites[0];
    expect(Object.keys(sampleSite).sort()).toEqual(["bodyNum", "buildId", "buildType", "id", "marketId", "name", "status"].sort());

    expect(rows.length).toBeGreaterThan(0);
  });

  it("uses configured weakLinkIds when present on the saved site", () => {
    const sysCopy = JSON.parse(JSON.stringify(sys)) as Sys;
    const target = sysCopy.sites.find(s => s.name === "Romarzs Rusty Refinery Refines Rusty Rocks")!;

    const fullMap = buildSystemModel2(sysCopy, false, true, {
      enableTerraformableAgricultureBonus: false,
    });
    const fullSite = fullMap.siteMaps.find(s => s.id === target.id)!;
    const agWeakSources = [...(fullSite.links?.weakSites ?? [])]
      .filter(s => s.type.inf === "agriculture")
      .sort((a, b) => a.name.localeCompare(b.name));

    target.weakLinkIds = agWeakSources.slice(0, 5).map(s => s.id);

    const filteredMap = buildSystemModel2(sysCopy, false, true, {
      enableTerraformableAgricultureBonus: false,
    });
    const site = filteredMap.siteMaps.find(s => s.id === target.id)!;

    expect(site.links?.weakSites.filter(s => s.type.inf === "agriculture")).toHaveLength(5);
    expect(site.economyAudit?.filter(e => e.inf === "agriculture" && e.reason.includes("weak link"))).toHaveLength(5);
    expect(roundPct(site.economies!.agriculture!)).toBe(25);
  });
});
