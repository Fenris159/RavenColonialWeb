import { applyBuffs, calculateAgricultureStrongLinkContribution, calculateColonyEconomies2 } from "./economy-model2";
import { Economy } from "./site-data";
import { EconomyMap, SiteMap2, SysMap2 } from "./system-model2";
import { BodyFeature } from "./types";
import { BT } from "./types2";

const createEconomyMap = (): EconomyMap => ({
  agriculture: 1,
  extraction: 0,
  hightech: 0,
  industrial: 0,
  military: 0,
  refinery: 0,
  service: 0,
  terraforming: 0,
  tourism: 0,
});

const createSite = (features: BodyFeature[], bodyType = BT.hmc): SiteMap2 => {
  const sys = {
    bodies: [],
    reserveLevel: "common",
  } as unknown as SysMap2;

  const body = {
    features,
    parents: [],
    type: bodyType,
  };

  return {
    body,
    economyAudit: [],
    sys,
  } as unknown as SiteMap2;
};

const createStrongLinkSite = (features: BodyFeature[], bodyType = BT.hmc): SiteMap2 => {
  const body = {
    features,
    name: "Test 1",
    num: 1,
    parents: [],
    type: bodyType,
  };

  const sys = {
    bodies: [body],
    reserveLevel: "common",
  } as unknown as SysMap2;

  return {
    body,
    economyAudit: [],
    sys,
  } as unknown as SiteMap2;
};

const createTidallyLockedSite = (bodyType = BT.hmc): SiteMap2 => {
  const star = {
    features: [],
    name: "Test",
    num: 0,
    parents: [],
    type: BT.st,
  };
  const body = {
    features: [BodyFeature.tidal],
    name: "Test 1",
    num: 1,
    parents: [0],
    type: bodyType,
  };

  const sys = {
    bodies: [star, body],
    reserveLevel: "common",
  } as unknown as SysMap2;

  return {
    body,
    economyAudit: [],
    sys,
  } as unknown as SiteMap2;
};

const createColonyPortWithStrongAgriLink = (): SiteMap2 => {
  const star = {
    features: [],
    name: "Test",
    num: 0,
    parents: [],
    type: BT.st,
  };
  const body = {
    features: [BodyFeature.tidal],
    name: "Test 1",
    num: 1,
    parents: [0],
    type: BT.hmc,
  };
  const sys = {
    bodies: [star, body],
    reserveLevel: "common",
  } as unknown as SysMap2;
  const source = {
    id: "source",
    name: "Agri source",
    type: {
      buildClass: "settlement",
      fixed: undefined,
      inf: "agriculture" as Economy,
      orbital: false,
      tier: 1,
    },
  } as unknown as SiteMap2;

  return {
    body,
    economyAudit: [],
    id: "target",
    links: {
      strongSites: [source],
      weakSites: [],
    },
    name: "Colony port",
    sys,
    type: {
      buildClass: "outpost",
      fixed: undefined,
      inf: "colony" as Economy,
      orbital: false,
      tier: 1,
    },
  } as unknown as SiteMap2;
};

const createFixedPortWithAgriLinks = (): SiteMap2 => {
  const site = createColonyPortWithStrongAgriLink();
  site.type = {
    buildClass: "outpost",
    fixed: "extraction" as Economy,
    inf: "extraction" as Economy,
    orbital: false,
    tier: 1,
  } as SiteMap2["type"];
  return site;
};

const createCivilianSurfaceOutpost = (
  buildType = "atropos",
  bodyType = BT.ib,
  features = [BodyFeature.atmosphere],
): SiteMap2 => {
  const body = {
    features,
    name: "Test 1",
    num: 1,
    parents: [],
    type: bodyType,
  };

  const sys = {
    bodies: [body],
    reserveLevel: "pristine",
  } as unknown as SysMap2;

  return {
    body,
    economyAudit: [],
    id: "civilian-outpost",
    buildType,
    links: {
      economies: {},
      strongSites: [],
      weakSites: [],
    },
    name: "Civilian outpost",
    sys,
    type: {
      buildClass: "outpost",
      displayName2: "Civilian Surface Outpost",
      inf: "colony" as Economy,
      orbital: false,
      tier: 1,
    },
  } as unknown as SiteMap2;
};

const createWeakSite = (id: string, inf: Economy): SiteMap2 => ({
  id,
  name: id,
  type: {
    inf,
    tier: 1,
  },
} as unknown as SiteMap2);

describe("applyBuffs agriculture", () => {
  it("does not apply the agriculture body buff for terraformable alone", () => {
    const map = createEconomyMap();
    const site = createSite([BodyFeature.terraformable]);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1);
    expect(site.economyAudit).toEqual([]);
  });

  it("still applies the agriculture body buff for biological signals", () => {
    const map = createEconomyMap();
    const site = createSite([BodyFeature.bio, BodyFeature.terraformable]);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1.4);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({
        inf: "agriculture",
        delta: 0.4,
        reason: "Buff: body has BIO",
      }),
    ]);
  });

  it("does not apply an extra agriculture body buff for ELW or WW bodies", () => {
    const map = createEconomyMap();
    const site = createSite([], BT.ww);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1);
    expect(site.economyAudit).toEqual([]);
  });

  it("applies the agriculture penalty for rocky-ice bodies", () => {
    const map = createEconomyMap();
    const site = createSite([BodyFeature.bio], BT.ri);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({ delta: 0.4, reason: "Buff: body has BIO" }),
      expect.objectContaining({ delta: -0.4, reason: "Buff: body is ICY/ROCKY-ICE or has TIDAL" }),
    ]);
  });

  it("does not apply the strong-link floor to direct body buff math", () => {
    const map = { ...createEconomyMap(), agriculture: 0.4 };
    const site = createTidallyLockedSite();

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(0);
  });
});

describe("calculateAgricultureStrongLinkContribution", () => {
  it("adds organics once and ignores terraformable while the feature flag is disabled", () => {
    const site = createStrongLinkSite([BodyFeature.bio, BodyFeature.terraformable]);

    expect(calculateAgricultureStrongLinkContribution(1, site).score).toBe(1.4);
  });

  it("can include terraformable bonus for intended-behavior predictions", () => {
    const site = createStrongLinkSite([BodyFeature.bio, BodyFeature.terraformable]);

    expect(calculateAgricultureStrongLinkContribution(1, site, { enableTerraformableAgricultureBonus: true }).score).toBe(1.8);
  });

  it("applies organics, rocky-ice, and tidal penalties additively", () => {
    const site = createTidallyLockedSite(BT.ri);
    site.body!.features.push(BodyFeature.bio);

    expect(calculateAgricultureStrongLinkContribution(1, site).score).toBe(0.6);
  });

  it("floors each depleted strong-link contribution at 0.1", () => {
    const site = createTidallyLockedSite();

    expect(calculateAgricultureStrongLinkContribution(0.4, site).score).toBe(0.1);
  });

  it("does not apply body modifiers to weak-link source values", () => {
    const site = createColonyPortWithStrongAgriLink();
    site.links!.strongSites = [];
    site.links!.weakSites = [{
      id: "weak",
      name: "Weak agri source",
      type: {
        inf: "agriculture" as Economy,
        tier: 1,
      },
    } as unknown as SiteMap2];

    calculateColonyEconomies2(site, ["weak"]);

    expect(site.economies!.agriculture).toBe(0.05);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        delta: 0.05,
        reason: "Apply weak link from: Weak agri source (source only)",
      }),
    );
    expect(site.economyAudit).not.toContainEqual(
      expect.objectContaining({ reason: "Colony port economy floor" }),
    );
  });

  it("does not floor linked Agriculture on a colony port when Agriculture is not a body-derived base economy", () => {
    const site = createColonyPortWithStrongAgriLink();

    calculateColonyEconomies2(site, ["source"]);

    expect(site.economies!.agriculture).toBe(0.1);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        delta: 0.1,
        reason: expect.stringContaining("=> floor 0.1"),
      }),
    );
    expect(site.economyAudit).not.toContainEqual(
      expect.objectContaining({ reason: "Colony port economy floor" }),
    );
  });

  it("keeps weak Agriculture links attenuated while omitting body modifiers", () => {
    const site = createFixedPortWithAgriLinks();
    site.links!.strongSites = [
      {
        id: "strong-1",
        name: "Strong agri 1",
        type: { inf: "agriculture" as Economy, tier: 1 },
      } as unknown as SiteMap2,
      {
        id: "strong-2",
        name: "Strong agri 2",
        type: { inf: "agriculture" as Economy, tier: 1 },
      } as unknown as SiteMap2,
      {
        id: "strong-3",
        name: "Strong agri 3",
        type: { inf: "agriculture" as Economy, tier: 1 },
      } as unknown as SiteMap2,
    ];
    site.links!.weakSites = [
      {
        id: "weak-1",
        name: "Weak agri 1",
        type: { inf: "agriculture" as Economy, tier: 1 },
      } as unknown as SiteMap2,
      {
        id: "weak-2",
        name: "Weak agri 2",
        type: { inf: "agriculture" as Economy, tier: 1 },
      } as unknown as SiteMap2,
    ];

    calculateColonyEconomies2(site, ["strong-1", "strong-2", "strong-3", "weak-1", "weak-2"]);

    expect(site.economies!.agriculture).toBe(0.4);
    expect(site.economyAudit).not.toContainEqual(
      expect.objectContaining({
        reason: "Colony port economy floor",
      }),
    );
    expect(site.economyAudit!.filter(x => x.reason.includes("=> floor 0.1"))).toHaveLength(3);
    expect(site.economyAudit!.filter(x => x.reason.includes("(source only)") && x.delta === 0.05)).toHaveLength(2);
  });

  it("uses the source port tier value for colony strong Agriculture links", () => {
    const site = createTidallyLockedSite(BT.hmc);
    site.type = {
      buildClass: "outpost",
      inf: "colony" as Economy,
      orbital: false,
      tier: 1,
    } as SiteMap2["type"];
    site.links = {
      economies: {},
      strongSites: [{
        economies: { ...createEconomyMap(), agriculture: 1 },
        id: "colony-source",
        intrinsic: ["agriculture"],
        name: "T3 colony source",
        primaryEconomy: "agriculture",
        type: {
          buildClass: "starport",
          inf: "colony" as Economy,
          orbital: false,
          tier: 3,
        },
      } as unknown as SiteMap2],
      weakSites: [],
    };

    calculateColonyEconomies2(site, ["colony-source"]);

    expect(site.economies!.agriculture).toBe(0.8);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        delta: 0.8,
        reason: expect.stringContaining("1.2 - TIDAL 0.4 = 0.8"),
      }),
    );
  });

  it("does not apply non-matching colony intrinsic economies to specialized fixed ports", () => {
    const site = createTidallyLockedSite(BT.ib);
    site.body!.features.push(BodyFeature.bio);
    site.type = {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: true,
      tier: 1,
    } as SiteMap2["type"];
    site.links = {
      economies: {},
      strongSites: [{
        economies: { ...createEconomyMap(), agriculture: 1, industrial: 1, terraforming: 1 },
        id: "colony-source",
        intrinsic: ["agriculture", "industrial", "terraforming"],
        name: "Surface colony source",
        primaryEconomy: "industrial",
        type: {
          buildClass: "outpost",
          inf: "colony" as Economy,
          orbital: false,
          tier: 1,
        },
      } as unknown as SiteMap2],
      weakSites: [],
    };

    calculateColonyEconomies2(site, ["colony-source"]);

    expect(site.economies!.agriculture).toBe(0);
    expect(site.economies!.terraforming).toBe(0);
    expect(site.economyAudit).toContainEqual(
      expect.objectContaining({
        inf: "industrial",
        delta: 0.4,
        reason: "Apply colony Strong link from: Surface colony source (T1)",
      }),
    );
  });

  it("applies observed preset economies for Atropos Civilian Surface Outposts", () => {
    const site = createCivilianSurfaceOutpost();
    site.links!.weakSites = [
      ...Array.from({ length: 13 }, (_, i) => createWeakSite(`refinery-${i}`, "refinery" as Economy)),
      ...Array.from({ length: 5 }, (_, i) => createWeakSite(`agriculture-${i}`, "agriculture" as Economy)),
      ...Array.from({ length: 3 }, (_, i) => createWeakSite(`military-${i}`, "military" as Economy)),
    ];

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.industrial).toBe(1.65);
    expect(site.economies!.refinery).toBe(1);
    expect(site.economies!.agriculture).toBe(0.8);
    expect(site.economies!.military).toBe(0.45);
    expect(site.economies!.extraction).toBe(0.65);
    expect(site.economies!.hightech).toBe(0.15);
  });

  it("does not stack the icy Atropos preset economies on BIO body economies", () => {
    const site = createCivilianSurfaceOutpost("atropos", BT.ib, [BodyFeature.atmosphere, BodyFeature.bio]);
    site.links!.weakSites = [
      ...Array.from({ length: 13 }, (_, i) => createWeakSite(`refinery-${i}`, "refinery" as Economy)),
      ...Array.from({ length: 5 }, (_, i) => createWeakSite(`agriculture-${i}`, "agriculture" as Economy)),
      ...Array.from({ length: 3 }, (_, i) => createWeakSite(`military-${i}`, "military" as Economy)),
    ];

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.industrial).toBe(1.4);
    expect(site.economies!.refinery).toBe(0.65);
    expect(site.economies!.agriculture).toBe(1.25);
    expect(site.economies!.military).toBe(0.15);
    expect(site.economies!.extraction).toBe(0);
    expect(site.economies!.hightech).toBe(0);
    expect(site.economyAudit!.some(x => x.reason.includes("Observed preset economy"))).toBe(false);
  });

  it("does not apply the Atropos preset economies to Nona Civilian Surface Outposts", () => {
    const site = createCivilianSurfaceOutpost("nona");
    site.links!.weakSites = [
      ...Array.from({ length: 13 }, (_, i) => createWeakSite(`refinery-${i}`, "refinery" as Economy)),
      ...Array.from({ length: 5 }, (_, i) => createWeakSite(`agriculture-${i}`, "agriculture" as Economy)),
      ...Array.from({ length: 2 }, (_, i) => createWeakSite(`military-${i}`, "military" as Economy)),
    ];
    site.links!.strongSites = [
      createWeakSite("military-strong", "military" as Economy),
    ];

    calculateColonyEconomies2(site, [...site.links!.weakSites, ...site.links!.strongSites].map(s => s.id));

    expect(site.economies!.industrial).toBe(1.4);
    expect(site.economies!.refinery).toBe(0.65);
    expect(site.economies!.agriculture).toBe(0.25);
    expect(site.economies!.military).toBe(0.5);
    expect(site.economies!.extraction).toBe(0);
    expect(site.economies!.hightech).toBe(0);
    expect(site.economyAudit!.some(x => x.reason.includes("Observed preset economy"))).toBe(false);
  });

  it("does not apply the icy Atropos preset economies to HMC Atropos Civilian Surface Outposts", () => {
    const site = createCivilianSurfaceOutpost("atropos", BT.hmc);
    site.links!.weakSites = [
      ...Array.from({ length: 13 }, (_, i) => createWeakSite(`refinery-${i}`, "refinery" as Economy)),
      ...Array.from({ length: 5 }, (_, i) => createWeakSite(`agriculture-${i}`, "agriculture" as Economy)),
      ...Array.from({ length: 3 }, (_, i) => createWeakSite(`military-${i}`, "military" as Economy)),
    ];

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.extraction).toBe(1.4);
    expect(site.economies!.refinery).toBe(0.65);
    expect(site.economies!.agriculture).toBe(0.25);
    expect(site.economies!.military).toBe(0.15);
    expect(site.economies!.industrial).toBe(0);
    expect(site.economies!.hightech).toBe(0);
    expect(site.economyAudit!.some(x => x.reason.includes("Observed preset economy"))).toBe(false);
  });
});
