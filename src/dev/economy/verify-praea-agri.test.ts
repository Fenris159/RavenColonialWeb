import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "praea-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "praea-spansh.json");

interface SpanshEconomy {
  id: number;
  updated: string;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

describe("Praea Euq QY-R d4-25 agriculture verification", () => {
  it("reports agriculture mismatches vs Spansh", () => {
    if (!fs.existsSync(SYSTEM_PATH) || !fs.existsSync(SPANSH_PATH)) {
      // eslint-disable-next-line no-console
      console.log("Skipping: run fetch first to populate praea-sys.json under os.tmpdir()");
      expect(true).toBe(true);
      return;
    }

    const sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    const spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry]));
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: true,
    });

    const rows: {
      name: string;
      marketId: number;
      estimate: number;
      spansh: number;
      diff: number;
      updated: string;
    }[] = [];

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }

      const real = spanshMap[site.marketId];
      if (!real || typeof real.economies.agriculture === "undefined") {
        continue;
      }

      const estimate = roundPct(site.economies.agriculture ?? 0);
      const spanshAg = real.economies.agriculture ?? 0;
      rows.push({
        name: site.name,
        marketId: site.marketId,
        estimate,
        spansh: spanshAg,
        diff: estimate - spanshAg,
        updated: real.updated,
      });
    }

    const mismatches = rows.filter(row => row.estimate !== row.spansh);
    const matches = rows.filter(row => row.estimate === row.spansh);

    // eslint-disable-next-line no-console
    console.log(`Praea: matches=${matches.length}, mismatches=${mismatches.length}, total=${rows.length}`);
    rows
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .forEach(row => {
        const mark = row.estimate === row.spansh ? "OK" : "MISMATCH";
        // eslint-disable-next-line no-console
        console.log(`  [${mark}] ${row.name}: model ${row.estimate}% vs spansh ${row.spansh}% (${row.diff >= 0 ? "+" : ""}${row.diff}) updated=${row.updated}`);
      });

    mismatches.forEach(row => {
      const site = sysMap.siteMaps.find(s => s.name === row.name);
      if (!site?.economyAudit) {
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`\n--- ${row.name} agriculture audit ---`);
      site.economyAudit
        .filter(e => e.inf === "agriculture")
        .forEach(e => console.log(`  ${e.delta >= 0 ? "+" : ""}${e.delta.toFixed(2)} -> ${e.after.toFixed(2)}: ${e.reason}`));
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(mismatches.length).toBe(0);
  });
});
