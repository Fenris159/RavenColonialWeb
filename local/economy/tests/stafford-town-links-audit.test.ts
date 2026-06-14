/**
 * Stafford Town in-game link UI vs RC graph (Synuefai fixture).
 * In-game: 1 strong (Derrickson agriculture) + 5 weak (mil, ext, ref, ind, ht).
 */
import * as fs from "fs";
import * as path from "path";
import {
  calculateColonyEconomies2,
  getAppliedWeakLinkCount,
  getAppliedWeakLinkSources,
} from "../../../src/economy";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "systems",
  "synuefai-cxv-c18-6",
  "rc-sys.json",
);

describe("Stafford Town link audit", () => {
  it("matches in-game 1 strong + 5 weak links", () => {
    if (!fs.existsSync(FIXTURE)) return;
    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const stafford = sysMap.siteMaps.find((s) => s.name === "Stafford Town")!;
    calculateColonyEconomies2(stafford, sysMap.calcIds);

    const strong = stafford.links?.strongSites ?? [];

    expect(strong.map((s) => s.name)).toContain("Derrickson's Folly");
    expect(stafford.links?.economies?.agriculture?.strong).toBe(1);
    expect(stafford.links?.economies?.military?.weak).toBe(1);
    expect(stafford.links?.economies?.extraction?.weak).toBe(1);
    expect(stafford.links?.economies?.refinery?.weak).toBe(1);
    expect(stafford.links?.economies?.industrial?.weak).toBe(1);
    expect(stafford.links?.economies?.hightech?.weak).toBe(1);
    expect(Math.round((stafford.economies?.agriculture ?? 0) * 100)).toBe(220);
    expect(Math.round((stafford.economies?.refinery ?? 0) * 100)).toBe(145);
    expect(getAppliedWeakLinkCount(stafford, "military")).toBeGreaterThanOrEqual(1);
    expect(getAppliedWeakLinkCount(stafford, "hightech")).toBeGreaterThanOrEqual(1);
    expect(getAppliedWeakLinkSources(stafford, "refinery")).toContain("Aristotle's Folly");
    expect(getAppliedWeakLinkSources(stafford, "agriculture")).not.toContain("Derrickson's Folly");
  });
});
