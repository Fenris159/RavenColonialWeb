import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "wredguia-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "wredguia-spansh.json");
const MIN_UPDATED = "2026-03-01T00:00:00Z";

interface SpanshEconomy {
  id: number;
  updated: string;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

const loadCachedSystem = () => {
  if (!fs.existsSync(SYSTEM_PATH) || !fs.existsSync(SPANSH_PATH)) {
    return null;
  }

  return {
    sys: JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys,
    spansh: JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[],
  };
};

describe("Wredguia ZP-C c27-8 agriculture verification", () => {
  const cached = loadCachedSystem();

  const compareAgriculture = () => {
    if (!cached) {
      return null;
    }

    const spanshMap = Object.fromEntries(cached.spansh.map(entry => [entry.id, entry]));
    const sysMap = buildSystemModel2(cached.sys, false, true, {
      enableTerraformableAgricultureBonus: true,
    });
    const cutoff = new Date(MIN_UPDATED).getTime();

    const rows: {
      name: string;
      marketId: number;
      estimate: number;
      spansh: number;
      diff: number;
    }[] = [];

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }

      const real = spanshMap[site.marketId];
      if (!real || typeof real.economies.agriculture === "undefined") {
        continue;
      }
      if (new Date(real.updated).getTime() < cutoff) {
        continue;
      }

      const estimate = roundPct(site.economies.agriculture ?? 0);
      const spansh = real.economies.agriculture ?? 0;
      rows.push({
        name: site.name,
        marketId: site.marketId,
        estimate,
        spansh,
        diff: estimate - spansh,
      });
    }

    return rows;
  };

  it("reports agriculture mismatches for recent Spansh snapshots", () => {
    const rows = compareAgriculture();
    if (!rows) {
      // eslint-disable-next-line no-console
      console.log("Skipping Wredguia verification: cached JSON not present under os.tmpdir()");
      expect(true).toBe(true);
      return;
    }

    const mismatches = rows.filter(row => row.estimate !== row.spansh);
    const matches = rows.filter(row => row.estimate === row.spansh);

    // eslint-disable-next-line no-console
    console.log(`Wredguia: matches=${matches.length}, mismatches=${mismatches.length}, recent=${rows.length}`);
    mismatches
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .forEach(row => console.log(`  ${row.name}: model ${row.estimate}% vs spansh ${row.spansh}% (${row.diff >= 0 ? "+" : ""}${row.diff})`));

    expect(rows.length).toBeGreaterThan(0);
    expect(mismatches.length).toBe(0);
  });
});
