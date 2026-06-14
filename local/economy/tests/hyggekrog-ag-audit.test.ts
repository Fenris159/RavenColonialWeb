import * as fs from "fs";
import * as path from "path";
import { bodyIsTidalToStar } from "../../../src/economy/economy-core";
import { calculateColonyEconomies2 } from "../../../src/economy";
import {
  getAgricultureIntrinsicBodyBuffDeltas,
  getAgricultureStrongLinkModifierDeltas,
} from "../../../src/economy/economy-ag-modifiers";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "systems",
  "col285-bwu-c3-1",
  "rc-sys.json",
);

describe("Hyggekrog agriculture tidal audit", () => {
  it("compares Hyggekrog vs Snail agriculture trail and tidal rules", () => {
    if (!fs.existsSync(FIXTURE)) return;

    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const holdfast = sysMap.siteMaps.find((s) => s.name === "Pelagic Holdfast Hyggekrog")!;
    const snail = sysMap.siteMaps.find((s) => s.name === "Snail's Safe Harbor")!;

    // eslint-disable-next-line no-console
    console.log("Hyggekrog body parents:", holdfast.body?.parents, "features:", holdfast.body?.features);
    // eslint-disable-next-line no-console
    console.log("bodyIsTidalToStar Hyggekrog:", bodyIsTidalToStar(sysMap, holdfast.body));
    // eslint-disable-next-line no-console
    console.log("bodyIsTidalToStar Snail:", bodyIsTidalToStar(sysMap, snail.body));
    // eslint-disable-next-line no-console
    console.log("intrinsic buffs Hyggekrog:", getAgricultureIntrinsicBodyBuffDeltas(holdfast));
    // eslint-disable-next-line no-console
    console.log("strong-link modifiers Snail:", getAgricultureStrongLinkModifierDeltas(snail));

    for (const site of [holdfast, snail]) {
      calculateColonyEconomies2(site, sysMap.calcIds);
      // eslint-disable-next-line no-console
      console.log(
        `\n${site.name} ag=${Math.round((site.economies?.agriculture ?? 0) * 100)}%`,
        (site.economyAudit ?? [])
          .filter((e) => e.inf === "agriculture")
          .map((e) => `${e.delta >= 0 ? "+" : ""}${Math.round(e.delta * 100)} ${e.reason}`)
          .join(" | "),
      );
    }
  });
});
