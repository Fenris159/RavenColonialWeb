import { buildSystemModel2 } from "./system-model2";
import { Sys } from "./types2";
import { EconomyMap } from "./site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "pleiades-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "pleiades-spansh.json");

interface SpanshEconomy {
  id: number;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

describe("Pleiades Sector MI-S B4-0 agriculture verification", () => {
  let sys: Sys;
  let spanshMap: Record<number, SpanshEconomy["economies"]>;

  beforeAll(async () => {
    if (!fs.existsSync(SYSTEM_PATH)) {
      const resp = await fetch(
        "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2/system/669611861281",
      );
      fs.writeFileSync(SYSTEM_PATH, await resp.text());
    }
    if (!fs.existsSync(SPANSH_PATH)) {
      const resp = await fetch(
        "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2/system/669611861281/spanshEconomies",
      );
      fs.writeFileSync(SPANSH_PATH, await resp.text());
    }

    sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry.economies]));
  }, 30000);

  const compareAgriculture = (useIncomplete: boolean, terraformableAgriBonus: boolean) => {
    const sysMap = buildSystemModel2(sys, useIncomplete, true, {
      enableTerraformableAgricultureBonus: terraformableAgriBonus,
    });

    const mismatches: {
      name: string;
      marketId: number;
      estimate: number;
      spansh: number;
      diff: number;
      body: string;
      bodyType: string;
      features: string[];
      buildType: string;
      typeInf: string;
      typeFixed?: string;
      orbital?: boolean;
      audit: string[];
    }[] = [];

    const matches: typeof mismatches = [];

    for (const site of sysMap.siteMaps) {
      if (site.status !== "complete" || !site.marketId || site.marketId <= 4_200_000_000 || !site.economies) {
        continue;
      }

      const real = spanshMap[site.marketId];
      if (!real || typeof real.agriculture === "undefined") {
        continue;
      }

      const estimate = roundPct(site.economies.agriculture ?? 0);
      const spansh = real.agriculture ?? 0;
      const entry = {
        name: site.name,
        marketId: site.marketId,
        estimate,
        spansh,
        diff: estimate - spansh,
        body: site.body?.name ?? "",
        bodyType: site.body?.type ?? "",
        features: site.body?.features ?? [],
        buildType: site.buildType,
        typeInf: site.type.inf,
        typeFixed: site.type.fixed,
        orbital: site.type.orbital,
        audit: (site.economyAudit ?? [])
          .filter(a => a.inf === "agriculture")
          .map(a => `${a.delta >= 0 ? "+" : ""}${a.delta} ${a.reason}`),
      };

      if (estimate === spansh) {
        matches.push(entry);
      } else {
        mismatches.push(entry);
      }
    }

    return { mismatches, matches };
  };

  it("reports agriculture mismatch patterns", () => {
    const { mismatches, matches } = compareAgriculture(false, false);
    // eslint-disable-next-line no-console
    console.log(`Matches: ${matches.length}, Mismatches: ${mismatches.length}`);
    mismatches
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
      .forEach(m => console.log(JSON.stringify(m)));

    expect(true).toBe(true);
  });
});
