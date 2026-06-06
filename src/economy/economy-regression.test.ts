import { EconomyMap } from "../site-data";
import { BodyFeature } from "../types";
import { BT } from "../types2";
import { applyBuffs } from "./economy-documented";
import { applyWeakLinks } from "./economy-documented";
import { SiteMap2, SysMap2 } from "./system-model2";

const createEconomyMap = (overrides?: Partial<EconomyMap>): EconomyMap => ({
  agriculture: 0,
  extraction: 0,
  hightech: 0,
  industrial: 0,
  military: 0,
  refinery: 0,
  service: 0,
  terraforming: 0,
  tourism: 0,
  ...overrides,
});

describe("economy regressions", () => {
  it("applies tourism buffs for neutron stars without requiring a black hole", () => {
    const neutronStar = {
      features: [],
      name: "Test NS",
      num: 1,
      parents: [],
      type: BT.ns,
    };
    const site = {
      body: neutronStar,
      economyAudit: [],
      sys: {
        bodies: [neutronStar],
        reserveLevel: "common",
      } as unknown as SysMap2,
    } as unknown as SiteMap2;
    const map = createEconomyMap({ tourism: 1 });

    applyBuffs(map, site, false);

    expect(map.tourism).toBe(1.4);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        delta: 0.4,
        inf: "tourism",
        reason: "Buff: system has a Neutron Star",
      }),
    );
  });

  it("labels uncapped agriculture weak links without Infinity in the audit", () => {
    const body = {
      features: [BodyFeature.landable],
      name: "Test 1",
      num: 1,
      parents: [],
      type: BT.rb,
    };
    const sys = {
      bodies: [body],
      reserveLevel: "common",
    } as unknown as SysMap2;
    const source = {
      body,
      buildType: "annona",
      id: "source",
      name: "Ag source",
      sys,
      type: {
        buildClass: "settlement",
        inf: "agriculture",
        orbital: false,
        tier: 1,
      },
    } as unknown as SiteMap2;
    const target = {
      body,
      buildType: "nemesis",
      economyAudit: [],
      id: "target",
      links: {
        economies: {},
        strongSites: [],
        weakSites: [source],
      },
      name: "Target",
      sys,
      type: {
        buildClass: "outpost",
        fixed: "military",
        inf: "military",
        orbital: false,
        tier: 1,
      },
    } as unknown as SiteMap2;
    const map = createEconomyMap();

    applyWeakLinks(map, target, [source.id, target.id]);

    expect(target.economyAudit).toContainEqual(
      expect.objectContaining({
        inf: "agriculture",
        reason: "Apply weak link from: Ag source (source only, uncapped)",
      }),
    );
    expect(target.economyAudit?.some(entry => entry.reason.includes("Infinity"))).toBe(false);
  });
});
