/**
 * Snail's Kelp Farm (demeter) weak-links cross-body ports; strong-links cluster primary only.
 */
import * as fs from "fs";
import * as path from "path";
import {
  calculateColonyEconomies2,
  getAppliedWeakLinkSources,
} from "../../../src/economy";
import { isAnchoredSpaceFarmInstallation } from "../../../src/economy/economy-link-sources";
import { siteContributesWeakLinks } from "../../../src/economy/economy-weak-links";
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

describe("Col 285 Kelp Farm weak links", () => {
  it("demeter weak-links Fort and Whelk (+5% ag) without duplicating Snail strong link", () => {
    if (!fs.existsSync(FIXTURE)) return;

    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const kelp = sysMap.siteMaps.find((s) => s.name === "Snail's Kelp Farm")!;
    const snail = sysMap.siteMaps.find((s) => s.name === "Snail's Safe Harbor")!;
    const fort = sysMap.siteMaps.find((s) => s.name === "Fort Snailing")!;
    const whelk = sysMap.siteMaps.find((s) => s.name === "Whelk Industrial Labs and Science LLC")!;

    expect(isAnchoredSpaceFarmInstallation(kelp)).toBe(false);
    expect(siteContributesWeakLinks(kelp)).toBe(true);
    expect(snail.links?.strongSites?.some((s) => s.id === kelp.id)).toBe(true);

    for (const port of [fort, whelk]) {
      calculateColonyEconomies2(port, sysMap.calcIds);
      const weakPool = [
        ...(port.links?.sameBodyWeakSites ?? []),
        ...(port.links?.weakSites ?? []),
      ];
      expect(weakPool.some((s) => s.id === kelp.id)).toBe(true);
      expect(getAppliedWeakLinkSources(port, "agriculture")).toContain("Snail's Kelp Farm");
      expect(Math.round((port.economies?.agriculture ?? 0) * 100)).toBe(5);
    }

    calculateColonyEconomies2(snail, sysMap.calcIds);
    expect(getAppliedWeakLinkSources(snail, "agriculture")).not.toContain("Snail's Kelp Farm");
    expect(Math.round((snail.economies?.agriculture ?? 0) * 100)).toBe(225);
  });
});
