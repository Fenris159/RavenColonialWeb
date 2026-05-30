import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";

interface SpanshEntry {
  id: number;
  updated: string;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (v: number) => Math.round(v * 100);

const compareSystem = (
  name: string,
  rcPath: string,
  spanshPath: string,
  minUpdated = "2026-01-01T00:00:00Z",
  terra = true,
) => {
  if (!fs.existsSync(rcPath) || !fs.existsSync(spanshPath)) {
    return null;
  }

  const sys = JSON.parse(fs.readFileSync(rcPath, "utf8")) as Sys;
  const spansh = JSON.parse(fs.readFileSync(spanshPath, "utf8")) as SpanshEntry[];
  const sysMap = buildSystemModel2(sys, false, true, { enableTerraformableAgricultureBonus: terra });
  const cutoff = new Date(minUpdated).getTime();

  let matches = 0;
  let mismatches = 0;
  const mismatchRows: string[] = [];

  for (const site of sysMap.siteMaps) {
    if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
      continue;
    }

    const sp = spansh.find(s => s.id === site.marketId);
    if (!sp || typeof sp.economies.agriculture === "undefined") {
      continue;
    }
    if (new Date(sp.updated).getTime() < cutoff) {
      continue;
    }

    const modelAgri = roundPct(site.economies.agriculture ?? 0);
    const spanshAgri = sp.economies.agriculture ?? 0;
    if (modelAgri === spanshAgri) {
      matches++;
    } else {
      mismatches++;
      mismatchRows.push(`${site.name}: model ${modelAgri}% vs spansh ${spanshAgri}% (${modelAgri - spanshAgri})`);
    }
  }

  return { name, matches, mismatches, mismatchRows };
};

describe("Spansh agriculture verification (2026+ snapshots)", () => {
  it("reports match rates for cached systems", () => {
    const results = [
      compareSystem("IC2391", "/tmp/ic2391-rc.json", "/tmp/ic2391-spansh-economies.json"),
      compareSystem("Synuefe", "/tmp/rc-synuefe.json", "/tmp/synuefe-spansh-economies.json"),
      compareSystem("Pleiades", "/tmp/rc-pleiades.json", "/tmp/pleiades-spansh-economies.json"),
    ].filter(Boolean) as NonNullable<ReturnType<typeof compareSystem>>[];

    for (const result of results) {
      // eslint-disable-next-line no-console
      console.log(`${result.name}: matches=${result.matches}, mismatches=${result.mismatches}`);
      result.mismatchRows.sort().forEach(row => console.log(`  ${row}`));
    }

    expect(results.length).toBeGreaterThan(0);
  });
});
