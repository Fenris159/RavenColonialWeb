/**
 * Gold Enterprise in-game link UI vs RC graph (Synuefai fixture).
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
import { siteContributesWeakLinks } from "../../../src/economy/economy-weak-links";

const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "systems",
  "synuefai-cxv-c18-6",
  "rc-sys.json",
);

describe("Gold Enterprise link audit", () => {
  it("prints RC strong/weak pools vs in-game 3+3 links", () => {
    if (!fs.existsSync(FIXTURE)) return;
    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const gold = sysMap.siteMaps.find((s) => s.name === "Gold Enterprise")!;
    calculateColonyEconomies2(gold, sysMap.calcIds);

    const strong = gold.links?.strongSites ?? [];
    const weak = [
      ...(gold.links?.sameBodyWeakSites ?? []),
      ...(gold.links?.weakSites ?? []),
    ].filter((s) => siteContributesWeakLinks(s));
    const dampier = sysMap.siteMaps.find((s) => s.name === "Dampier Gateway");

    // eslint-disable-next-line no-console
    console.log("\n=== Gold Enterprise RC link graph ===");
    // eslint-disable-next-line no-console
    console.log(
      "strongSites:",
      strong.map((s) => `${s.name} (${s.buildType}, ${s.type.inf}, T${s.type.tier})`).join("; "),
    );
    // eslint-disable-next-line no-console
    console.log(
      "weak pool:",
      weak.map((s) => `${s.name} (${s.buildType}, ${s.type.inf})`).join("; "),
    );
    // eslint-disable-next-line no-console
    console.log(
      "Dampier:",
      dampier
        ? `parent=${dampier.parentLink?.name ?? "none"} contributes=${siteContributesWeakLinks(dampier)} inf=${dampier.type.inf}`
        : "missing",
    );
    // eslint-disable-next-line no-console
    console.log("economies:", gold.economies);
    // eslint-disable-next-line no-console
    console.log("\nIn-game UI: 3 strong (Aristotle/refinery, Grover/extraction, Saez/industrial)");
    // eslint-disable-next-line no-console
    console.log("In-game UI: 3 weak (agriculture, hightech, military) — 6 total links");

    expect(strong.map((s) => s.name).sort()).toEqual(
      ["Aristotle's Folly", "Grover's Claim", "Saez Synthetics Facility"].sort(),
    );
    expect(gold.links?.economies?.refinery?.strong).toBe(1);
    expect(gold.links?.economies?.extraction?.strong).toBe(1);
    expect(gold.links?.economies?.industrial?.strong).toBe(1);
    expect(gold.links?.economies?.agriculture?.weak).toBe(1);
    expect(gold.links?.economies?.hightech?.weak).toBe(1);
    expect(gold.links?.economies?.military?.weak).toBe(1);
    expect(strong.some((s) => s.buildType === "demeter")).toBe(false);
    expect(weak.some((s) => s.name.includes("Grover") || s.name.includes("Saez"))).toBe(false);
    expect(Math.round((gold.economies?.agriculture ?? 0) * 100)).toBe(145);
    expect(Math.round((gold.economies?.extraction ?? 0) * 100)).toBe(80);
    expect(Math.round((gold.economies?.industrial ?? 0) * 100)).toBe(120);
    expect(Math.round((gold.economies?.refinery ?? 0) * 100)).toBe(260);
    expect(Math.round((gold.economies?.terraforming ?? 0) * 100)).toBe(100);
    expect(getAppliedWeakLinkSources(gold, "agriculture")).toContain("Stafford Town");
    expect(Math.round((gold.economies?.military ?? 0) * 100)).toBe(10);
    expect(getAppliedWeakLinkCount(gold, "military")).toBeGreaterThanOrEqual(1);
    expect(gold.links?.economies?.hightech?.weak).toBe(1);
    expect(Math.round((gold.economies?.hightech ?? 0) * 100)).toBe(0);
    expect(getAppliedWeakLinkCount(gold, "hightech")).toBe(0);
    expect(getAppliedWeakLinkCount(gold, "refinery")).toBe(0);
    expect(getAppliedWeakLinkCount(gold, "terraforming")).toBe(0);
    // eslint-disable-next-line no-console
    console.log(
      "applied weak:",
      ["agriculture", "hightech", "military", "refinery", "terraforming"]
        .map((k) => `${k}=${getAppliedWeakLinkSources(gold, k as any).join(",") || "—"}`)
        .join("; "),
    );
  });
});
