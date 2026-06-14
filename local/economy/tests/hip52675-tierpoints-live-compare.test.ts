import * as fs from "fs";
import * as path from "path";
import { applyTax, buildSystemModel2, SiteMap2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const fixtureDir = path.join(process.cwd(), "local", "economy", "fixtures", "systems", "hip52675");

const cloneSys = (sys: Sys): Sys => JSON.parse(JSON.stringify(sys));

const sumLiveTierPoints = (siteMaps: SiteMap2[], calcIds: string[], incBuildStarted?: boolean) => {
  const tierPoints = { tier2: 0, tier3: 0 };
  const primaryPortId = siteMaps && siteMaps[0]?.id;
  let taxCount = -2;

  for (const site of siteMaps) {
    if (site.status === "demolish") { continue; }
    if (incBuildStarted) {
      if (site.status === "plan") { continue; }
    } else if (!calcIds.includes(site.id)) { continue; }

    if (site.id !== primaryPortId && site.type.needs.count > 0 && site.type.needs.tier > 1) {
      let needCount = site.type.needs.count;
      if (site.type.buildClass === "starport" && site.type.tier > 1) {
        taxCount++;
        needCount = applyTax(site.type.tier, needCount, taxCount);
      }

      const tierName = site.type.needs.tier === 2 ? "tier2" : "tier3";
      tierPoints[tierName] -= needCount;
    }

    if (!calcIds.includes(site.id)) { continue; }

    if (site.type.gives.count > 0 && site.type.gives.tier > 1) {
      const tierName = site.type.gives.tier === 2 ? "tier2" : "tier3";
      tierPoints[tierName] += site.type.gives.count;
    }
  }

  return { tierPoints, taxCount };
};

describe("HIP 52675 tier point comparison", () => {
  it("compares current body-sorted tier points against deployed live formula", () => {
    const sys = JSON.parse(fs.readFileSync(path.join(fixtureDir, "rc-sys.json"), "utf8")) as Sys;
    const current = buildSystemModel2(cloneSys(sys), true, undefined, {
      enableTerraformableAgricultureBonus: true,
    });
    const live = sumLiveTierPoints(current.siteMaps, current.calcIds, false);

    expect(live.tierPoints).toEqual({ tier2: 0, tier3: 12 });
    expect(current.tierPoints).toEqual(live.tierPoints);
    expect(current.taxCount).toBe(live.taxCount);
  });
});
