import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "synuefe-sys.json");
const SPANSH_URL =
  "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2/system/1183431070442/spanshEconomies";

interface SpanshEconomy {
  id: number;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const roundPct = (value: number) => Math.round(value * 100);

describe("Synuefe OU-F c27-4 agriculture verification", () => {
  let sys: Sys;
  let spanshMap: Record<number, SpanshEconomy["economies"]>;

  beforeAll(async () => {
    if (!fs.existsSync(SYSTEM_PATH)) {
      const resp = await fetch(
        "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2/system/1183431070442",
      );
      fs.writeFileSync(SYSTEM_PATH, await resp.text());
    }

    sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spanshResp = await fetch(SPANSH_URL);
    const spansh = (await spanshResp.json()) as SpanshEconomy[];
    spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry.economies]));
  }, 30000);

  const compareAgriculture = () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    return sysMap.siteMaps
      .filter(site => site.status === "complete" && site.marketId > 4_200_000_000 && site.economies)
      .flatMap(site => {
        const real = spanshMap[site.marketId];
        if (!real || typeof real.agriculture === "undefined") {
          return [];
        }

        const estimate = roundPct(site.economies!.agriculture ?? 0);
        const spansh = real.agriculture ?? 0;
        if (estimate === spansh) {
          return [];
        }

        return [{
          name: site.name,
          marketId: site.marketId,
          estimate,
          spansh,
          diff: estimate - spansh,
        }];
      });
  };

  it("matches Sturgeon City agriculture against Spansh after specialized-port filtering", () => {
    const mismatches = compareAgriculture();
    const sturgeon = mismatches.find(entry => entry.marketId === 4207954691);
    expect(sturgeon).toBeUndefined();
  });

  it("logs remaining agriculture mismatches for investigation", () => {
    const mismatches = compareAgriculture();
    // eslint-disable-next-line no-console
    console.log(`Remaining agriculture mismatches: ${mismatches.length}`);
    mismatches.forEach(entry => console.log(JSON.stringify(entry)));
    expect(mismatches.length).toBeLessThanOrEqual(3);
  });
});
