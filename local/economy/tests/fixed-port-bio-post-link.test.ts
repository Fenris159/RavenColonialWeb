import { applyFixedPortPostLinkBodyBuffs } from "../../../src/economy/economy-documented";
import { EconomyMap, SiteMap2, SysMap2 } from "../../../src/economy/system-model2";
import { Economy } from "../../../src/site-data";
import { BodyFeature } from "../../../src/types";
import { BT } from "../../../src/types2";

const createEconomyMap = (agriculture: number): EconomyMap => ({
  agriculture,
  extraction: 0,
  hightech: 0,
  industrial: 1.4,
  military: 0,
  refinery: 0,
  service: 0,
  terraforming: 0,
  tourism: 0,
});

const createFixedBioPort = (): SiteMap2 => {
  const body = {
    features: [BodyFeature.bio],
    name: "Test 1 f",
    num: 16,
    parents: [],
    type: BT.ib,
  };

  return {
    body,
    economyAudit: [],
    id: "fixed-port",
    name: "Fixed BIO port",
    sys: {
      bodies: [body],
      reserveLevel: "pristine",
    } as unknown as SysMap2,
    type: {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: true,
      tier: 1,
    },
  } as unknown as SiteMap2;
};

describe("fixed specialised port BIO post-link buff", () => {
  it("adds 40% agriculture and 40% terraforming after links create agriculture", () => {
    const site = createFixedBioPort();
    const map = createEconomyMap(1.05);

    applyFixedPortPostLinkBodyBuffs(map, site);

    expect(map.agriculture).toBe(1.45);
    expect(map.terraforming).toBe(0.4);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        inf: "agriculture",
        delta: 0.4,
        reason: "Buff: body has BIO",
      }),
    );
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        inf: "terraforming",
        delta: 0.4,
        reason: "Buff: body has BIO",
      }),
    );
  });

  it("does not add BIO agriculture or terraforming when no agriculture links exist", () => {
    const site = createFixedBioPort();
    const map = createEconomyMap(0);

    applyFixedPortPostLinkBodyBuffs(map, site);

    expect(map.agriculture).toBe(0);
    expect(map.terraforming).toBe(0);
    expect(site.economyAudit).toEqual([]);
  });

  it("does not add BIO agriculture or terraforming for a single agriculture weak link", () => {
    const site = createFixedBioPort();
    const map = createEconomyMap(0.05);

    applyFixedPortPostLinkBodyBuffs(map, site);

    expect(map.agriculture).toBe(0.05);
    expect(map.terraforming).toBe(0);
    expect(site.economyAudit).toEqual([]);
  });
});
