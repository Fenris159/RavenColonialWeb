import * as fs from "fs";
import * as path from "path";
import { buildSystemModel2, SiteMap2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";
import type { GalaxyStationEconomy } from "../lib/galaxy-stations-util";
import { buildGalaxyStationLookup, resolveFreshGalaxyStationForSite } from "../lib/galaxy-stations-matching";

const fixtureDir = path.join(process.cwd(), "local", "economy", "fixtures", "systems", "hip52675");
const swapNames = [
  ["Duan Industries", "Savchenko Vista"],
  ["Zuniga Platform", "Buhle Territories"],
  ["Biswas Horizon", "Dara Garden"],
  ["Preuss Platform", "Laumer Platform"],
  ["Barron Town", "Marvin Landing"],
  ["Shoujing Terminal", "Braun Depot"],
];

const cloneSys = (sys: Sys): Sys => JSON.parse(JSON.stringify(sys));

const putFirstBeforeSecond = (sys: Sys, firstName: string, secondName: string) => {
  const firstIdx = sys.sites.findIndex(s => s.name === firstName);
  const secondIdx = sys.sites.findIndex(s => s.name === secondName);
  if (firstIdx < 0 || secondIdx < 0 || firstIdx < secondIdx) {
    return;
  }
  const [first] = sys.sites.splice(firstIdx, 1);
  const newSecondIdx = sys.sites.findIndex(s => s.name === secondName);
  sys.sites.splice(newSecondIdx, 0, first);
};

const getTargetRows = (sites: SiteMap2[], stations: GalaxyStationEconomy[]) => {
  const lookup = buildGalaxyStationLookup(stations, { playerMadeOnly: true });
  return sites
    .filter(site => site.status === "complete")
    .map(site => {
      const resolved = resolveFreshGalaxyStationForSite(
        { name: site.name, marketId: site.marketId },
        lookup,
        90 * 24 * 60 * 60 * 1000,
        { preferNameMatch: true },
      );
      const spanshAg = resolved.station?.economies?.agriculture;
      if (!resolved.fresh || typeof spanshAg !== "number") {
        return undefined;
      }
      const modelAg = Math.round((site.economies?.agriculture ?? 0) * 100);
      if (modelAg === spanshAg) {
        return undefined;
      }
      return { site, modelAg, spanshAg };
    })
    .filter(Boolean) as { site: SiteMap2; modelAg: number; spanshAg: number }[];
};

describe("HIP 52675 agriculture after manual inversion correction", () => {
  it("prints the remaining agriculture mismatches and audits", () => {
    const sys = cloneSys(JSON.parse(fs.readFileSync(path.join(fixtureDir, "rc-sys.json"), "utf8")) as Sys);
    const spansh = JSON.parse(fs.readFileSync(path.join(fixtureDir, "spansh-stations.json"), "utf8")) as {
      stations: GalaxyStationEconomy[];
    };

    for (const [primaryName, partnerName] of swapNames) {
      putFirstBeforeSecond(sys, primaryName, partnerName);
    }

    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: true,
    });
    const rows = getTargetRows(sysMap.siteMaps, spansh.stations);
    const lookup = buildGalaxyStationLookup(spansh.stations, { playerMadeOnly: true });

    // eslint-disable-next-line no-console
    console.log("\nRemaining agriculture mismatches:", rows.map(r => `${r.site.name} ${r.modelAg}->${r.spanshAg}`).join("; "));
    for (const row of rows.filter(r => ["Barron Town", "Christy Beacon", "Si-myung Legacy"].includes(r.site.name))) {
      // eslint-disable-next-line no-console
      console.log(`\n${row.site.name} ${row.modelAg}->${row.spanshAg}`);
      // eslint-disable-next-line no-console
      console.log("body:", row.site.body?.name, row.site.body?.type, row.site.body?.features?.join(",") || "-");
      // eslint-disable-next-line no-console
      console.log("strong:", row.site.links?.strongSites.map(s => `${s.name}(${s.buildType})`).join("; ") || "(none)");
      // eslint-disable-next-line no-console
      console.log("ag audit:", row.site.economyAudit?.filter(a => a.inf === "agriculture").map(a => `${a.delta}: ${a.reason}`).join(" ; ") || "(none)");
    }

    for (const name of ["Barron Town", "Christy Beacon", "Si-myung Legacy"]) {
      const site = sysMap.siteMaps.find(s => s.name === name)!;
      const resolved = resolveFreshGalaxyStationForSite(
        { name: site.name, marketId: site.marketId },
        lookup,
        90 * 24 * 60 * 60 * 1000,
        { preferNameMatch: true },
      );
      expect(Math.round((site.economies?.agriculture ?? 0) * 100)).toBe(resolved.station?.economies?.agriculture);
    }
    expect(rows).toEqual([]);
  });
});
