/**
 * Conch (poena security installation) weak-links Fort Snailing per Update 3 /
 * Mega Guide supporting-facility rules (Col 285 fixture).
 */
import * as fs from "fs";
import * as path from "path";
import { calculateColonyEconomies2 } from "../../../src/economy";
import {
  isSecurityInstallation,
  securityWeakLinkAppliesEconomyTo,
  siteContributesWeakLinks,
} from "../../../src/economy/economy-weak-links";
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

describe("Fort Snailing security installation weak link", () => {
  it("applies Conch +5% military (Spansh 195%)", () => {
    if (!fs.existsSync(FIXTURE)) return;

    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const fort = sysMap.siteMaps.find((s) => s.name === "Fort Snailing")!;
    const conch = sysMap.siteMaps.find((s) => s.name === "Conch Listening Post")!;
    const alastor = sysMap.siteMaps.find((s) => s.name === "Linteris's Pride");

    calculateColonyEconomies2(fort, sysMap.calcIds);

    expect(isSecurityInstallation(conch)).toBe(true);
    expect(siteContributesWeakLinks(conch)).toBe(true);
    expect(conch.buildType).toBe("poena");

    const weakPool = [
      ...(fort.links?.sameBodyWeakSites ?? []),
      ...(fort.links?.weakSites ?? []),
    ];
    expect(weakPool.some((s) => s.id === conch.id)).toBe(true);

    const militaryWeakAudit = (fort.economyAudit ?? []).filter(
      (e) => e.inf === "military" && e.reason.startsWith("Apply weak link"),
    );
    expect(securityWeakLinkAppliesEconomyTo(conch, fort)).toBe(true);
    expect(militaryWeakAudit.some((e) => e.reason.includes("Conch Listening Post"))).toBe(
      true,
    );
    expect(Math.round((fort.economies?.military ?? 0) * 100)).toBe(195);

    for (const name of [
      "Snail's Safe Harbor",
      "Pelagic Holdfast Hyggekrog",
      "Whelk Industrial Labs and Science LLC",
    ]) {
      const port = sysMap.siteMaps.find((s) => s.name === name)!;
      calculateColonyEconomies2(port, sysMap.calcIds);
      const portWeak = (port.economyAudit ?? []).filter(
        (e) => e.inf === "military" && e.reason.startsWith("Apply weak link"),
      );
      expect(portWeak.some((e) => e.reason.includes("Conch Listening Post"))).toBe(true);
      expect(Math.round((port.economies?.military ?? 0) * 100)).toBe(20);
    }

    if (alastor?.status === "complete") {
      expect(siteContributesWeakLinks(alastor)).toBe(false);
    }
  });
});
