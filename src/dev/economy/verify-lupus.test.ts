import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "lupus-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "lupus-spansh.json");

interface SpanshEconomy {
  id: number;
  updated: string;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

const parseUpdated = (updated: string) => new Date(updated.replace(" ", "T").replace("+00", "Z")).getTime();

describe("Lupus Dark Region B Sector AF-Z b1 agriculture verification", () => {
  it("reports mismatches grouped by Spansh freshness", () => {
    if (!fs.existsSync(SYSTEM_PATH) || !fs.existsSync(SPANSH_PATH)) {
      // eslint-disable-next-line no-console
      console.log("Skipping: cached JSON not present");
      expect(true).toBe(true);
      return;
    }

    const sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    const spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry]));
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: true,
    });

    const now = Date.now();
    const days90 = 90 * 24 * 60 * 60 * 1000;
    const days180 = 180 * 24 * 60 * 60 * 1000;
    const march2026 = new Date("2026-03-01T00:00:00Z").getTime();

    type Row = {
      name: string;
      marketId: number;
      estimate: number;
      spansh: number;
      diff: number;
      updated: string;
      ageDays: number;
    };

    const rows: Row[] = [];
    const noSpanshAg: string[] = [];

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }

      const real = spanshMap[site.marketId];
      if (!real || typeof real.economies.agriculture === "undefined") {
        noSpanshAg.push(`${site.name} (${site.marketId})`);
        continue;
      }

      const updatedMs = parseUpdated(real.updated);
      rows.push({
        name: site.name,
        marketId: site.marketId,
        estimate: roundPct(site.economies.agriculture ?? 0),
        spansh: real.economies.agriculture ?? 0,
        diff: roundPct(site.economies.agriculture ?? 0) - (real.economies.agriculture ?? 0),
        updated: real.updated,
        ageDays: Math.round((now - updatedMs) / (24 * 60 * 60 * 1000)),
      });
    }

    const bucket = (label: string, filter: (r: Row) => boolean) => {
      const subset = rows.filter(filter);
      const matches = subset.filter(r => r.estimate === r.spansh);
      const mismatches = subset.filter(r => r.estimate !== r.spansh);
      // eslint-disable-next-line no-console
      console.log(`\n${label}: total=${subset.length} match=${matches.length} mismatch=${mismatches.length}`);
      mismatches
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 15)
        .forEach(r => console.log(`  ${r.name}: model ${r.estimate}% spansh ${r.spansh}% (${r.diff >= 0 ? "+" : ""}${r.diff}) updated=${r.updated} (${r.ageDays}d ago)`));
      return { subset, matches, mismatches };
    };

    // eslint-disable-next-line no-console
    console.log(`System: ${sys.name}, rev ${sys.rev}, sites with ag spansh=${rows.length}, no spansh ag=${noSpanshAg.length}`);

    const recent90 = bucket("Last 90 days", r => now - parseUpdated(r.updated) <= days90);
    const mid = bucket("90-180 days", r => {
      const age = now - parseUpdated(r.updated);
      return age > days90 && age <= days180;
    });
    const old = bucket("Older than 180 days", r => now - parseUpdated(r.updated) > days180);
    const sinceMarch2026 = bucket("Since 2026-03-01", r => parseUpdated(r.updated) >= march2026);

    // Flag large mismatches on recent data only
    const recentBig = recent90.mismatches.filter(r => Math.abs(r.diff) >= 10);
    // eslint-disable-next-line no-console
    console.log(`\nRecent (90d) mismatches |diff|>=10%: ${recentBig.length}`);
    recentBig.forEach(r => console.log(`  ${r.name}: ${r.diff}% (${r.ageDays}d)`));

    // Don't fail the test - exploratory report
    expect(rows.length).toBeGreaterThan(0);
    expect(recent90.mismatches.length + mid.mismatches.length + old.mismatches.length).toBeGreaterThanOrEqual(0);
  });
});
