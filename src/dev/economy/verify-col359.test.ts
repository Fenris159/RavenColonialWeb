import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "col359-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "col359-spansh.json");

interface SpanshEconomy {
  id: number;
  updated: string;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

describe("Col 359 Sector LQ-J b11-1 verification", () => {
  it("reports Penfold Exploration vs Spansh", () => {
    if (!fs.existsSync(SYSTEM_PATH) || !fs.existsSync(SPANSH_PATH)) {
      // eslint-disable-next-line no-console
      console.log("Skipping: cached JSON not present under os.tmpdir()");
      expect(true).toBe(true);
      return;
    }

    const sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    const spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry]));
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: true,
    });

    const site = sysMap.siteMaps.find(s => s.name === "Penfold Exploration");
    expect(site).toBeDefined();

    const real = spanshMap[site!.marketId!];
    // eslint-disable-next-line no-console
    console.log("\nPenfold Exploration economies:");
    for (const key of Object.keys(site!.economies ?? {}).sort()) {
      const inf = key as keyof EconomyMap;
      const model = roundPct(site!.economies![inf] ?? 0);
      const sp = real?.economies?.[inf];
      if (model > 0 || (sp ?? 0) > 0) {
        const mark = sp !== undefined && model === sp ? "OK" : "MISMATCH";
        // eslint-disable-next-line no-console
        console.log(`  [${mark}] ${inf}: model ${model}% spansh ${sp ?? "?"}%`);
      }
    }

    // eslint-disable-next-line no-console
    console.log("\nAgriculture audit:");
    site!.economyAudit
      ?.filter(e => e.inf === "agriculture")
      .forEach(e => console.log(`  ${e.delta >= 0 ? "+" : ""}${e.delta.toFixed(2)} -> ${e.after.toFixed(2)}: ${e.reason}`));

    const mismatches: string[] = [];
    if (real?.economies) {
      for (const [key, spVal] of Object.entries(real.economies)) {
        const inf = key as keyof EconomyMap;
        const model = roundPct(site!.economies![inf] ?? 0);
        if (model !== spVal) {
          mismatches.push(`${inf}: model ${model}% vs spansh ${spVal}%`);
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\nMismatches: ${mismatches.length}`);
    mismatches.forEach(m => console.log(`  ${m}`));

    expect(mismatches.length).toBe(0);
  });
});
