import * as fs from "fs";
import * as path from "path";
import {
  calculateColonyEconomies2,
  getAppliedWeakLinkSources,
} from "../../../src/economy";
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

describe("Snail relay hightech", () => {
  it("applies Radula Relay +5% on top of chronos weak link (Spansh 10%)", () => {
    if (!fs.existsSync(FIXTURE)) return;

    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const snail = sysMap.siteMaps.find((s) => s.name === "Snail's Safe Harbor")!;

    calculateColonyEconomies2(snail, sysMap.calcIds);

    expect(Math.round((snail.economies?.hightech ?? 0) * 100)).toBe(10);
    expect(getAppliedWeakLinkSources(snail, "hightech")).toEqual([
      "Osphradium Research Station",
      "Radula Relay Hub",
    ]);
  });
});
