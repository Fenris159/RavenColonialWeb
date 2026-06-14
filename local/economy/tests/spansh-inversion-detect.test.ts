import {
  detectSameBodySpanshInversions,
} from "../../../src/economy/compare/spansh-inversion-detect";
import type { EconomyMap, SiteMap2, SysMap2 } from "../../../src/economy/system-model2";

const siteType = {
  padSize: "large",
  buildClass: "starport",
  orbital: false,
};

const makeSite = (
  id: string,
  name: string,
  economies: Partial<EconomyMap>,
  body: any,
): SiteMap2 => {
  const site = {
    id,
    name,
    status: "complete",
    economies,
    type: siteType,
    body,
    bodyNum: body.num,
    marketId: Number(id.replace(/\D/g, "")) || undefined,
  } as SiteMap2;
  body.sites.push(site);
  body.surface.push(site);
  return site;
};

const makeSysMap = (sites: SiteMap2[]): SysMap2 => ({
  name: "Test System",
  sites,
  siteMaps: sites,
} as SysMap2);

const resolverFor = (rows: Record<string, Partial<Record<keyof EconomyMap, number>>>) =>
  (site: SiteMap2) => ({
    row: {
      economies: rows[site.id],
    },
  });

describe("detectSameBodySpanshInversions", () => {
  it("flags exact same-body swapped Spansh economies", () => {
    const body = { num: 1, name: "Test 1", sites: [], surface: [], orbital: [] };
    const dara = makeSite("S1", "Dara Garden", { agriculture: 0.6, industrial: 0.4 }, body);
    const biswas = makeSite("S2", "Biswas Horizon", { tourism: 0.7, military: 0.3 }, body);
    body.surfacePrimary = dara;

    const hints = detectSameBodySpanshInversions(
      makeSysMap([dara, biswas]),
      resolverFor({
        S1: { tourism: 70, military: 30 },
        S2: { agriculture: 60, industrial: 40 },
      }),
      [dara.id, biswas.id],
    );

    expect(hints[dara.id]).toMatchObject({
      swapWithSiteId: biswas.id,
      direction: "down",
      confidence: "exact",
    });
    expect(hints[biswas.id]).toMatchObject({
      swapWithSiteId: dara.id,
      direction: "up",
      confidence: "exact",
    });
  });

  it("flags strong stale-data swaps when the richer economy set appears on the market-link primary partner", () => {
    const body = { num: 1, name: "Test 1", sites: [], surface: [], orbital: [] };
    const primary = makeSite("S1", "Primary Link", {
      agriculture: 0.4,
      industrial: 0.3,
      hightech: 0.2,
      service: 0.1,
    }, body);
    const partner = makeSite("S2", "Subordinate Port", {
      tourism: 0.7,
      military: 0.3,
    }, body);
    body.surfacePrimary = primary;

    const hints = detectSameBodySpanshInversions(
      makeSysMap([primary, partner]),
      resolverFor({
        S1: { tourism: 60, military: 30 },
        S2: { agriculture: 39, industrial: 31, hightech: 20, service: 10 },
      }),
      [primary.id, partner.id],
    );

    expect(hints[primary.id]).toMatchObject({
      swapWithSiteId: partner.id,
      direction: "down",
      confidence: "strong",
    });
    expect(hints[primary.id].reasons.join(" ")).toContain("market-link primary");
  });

  it("does not flag ordinary stale mismatches that do not improve when swapped", () => {
    const body = { num: 1, name: "Test 1", sites: [], surface: [], orbital: [] };
    const a = makeSite("S1", "Alpha", { agriculture: 0.5, industrial: 0.5 }, body);
    const b = makeSite("S2", "Beta", { tourism: 0.5, military: 0.5 }, body);
    body.surfacePrimary = a;

    const hints = detectSameBodySpanshInversions(
      makeSysMap([a, b]),
      resolverFor({
        S1: { agriculture: 45, industrial: 55 },
        S2: { tourism: 45, military: 55 },
      }),
      [a.id, b.id],
    );

    expect(hints).toEqual({});
  });
});
