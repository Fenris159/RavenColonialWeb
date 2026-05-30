import { applyBuffs, calculateAgricultureStrongLinkContribution, calculateColonyEconomies2, getColonyEconomyBeforeWeakLinks, isGroundOrbitColonyPair } from "../../economy-model2";
import { applyAgricultureSettlementFloor } from "../../economy-ag-heuristics";
import { Economy } from "../../site-data";
import { EconomyMap, SiteMap2, SysMap2 } from "../../system-model2";
import { BodyFeature } from "../../types";
import { BT } from "../../types2";

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

  it("applies the ELW or WW agriculture body buff", () => {
    const map = createEconomyMap();
    const site = createSite([], BT.ww);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1.4);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({ delta: 0.4, reason: "Buff: body is ELW or WW" }),
    ]);
  });

  it("applies the agriculture penalty for rocky-ice bodies", () => {
    const map = createEconomyMap();
    const site = createSite([BodyFeature.bio], BT.ri);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({ delta: 0.4, reason: "Buff: body has BIO" }),
      expect.objectContaining({ delta: -0.4, reason: "Buff: body is ICY/ROCKY-ICE" }),
    ]);
  });

  it("stacks icy and tidal agriculture penalties separately", () => {
    const map = createEconomyMap();
    const site = createTidallyLockedSite(BT.ib);
    site.body!.features.push(BodyFeature.bio);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(0.6);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({ delta: 0.4, reason: "Buff: body has BIO" }),
      expect.objectContaining({ delta: -0.4, reason: "Buff: body is ICY/ROCKY-ICE" }),
      expect.objectContaining({ delta: -0.4, reason: "Buff: body has TIDAL" }),
    ]);
  });

  it("floors tidally locked WW agriculture at 1.0 after body buffs", () => {
    const map = createEconomyMap();
    const site = createTidallyLockedSite(BT.ww);

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(1);
    expect(site.economyAudit).toEqual([
      expect.objectContaining({ delta: 0.4, reason: "Buff: body is ELW or WW" }),
      expect.objectContaining({ delta: -0.4, reason: "Buff: body has TIDAL" }),
    ]);
  });

  it("does not apply the strong-link floor to direct body buff math", () => {
    const map = { ...createEconomyMap(), agriculture: 0.4 };
    const site = createTidallyLockedSite();

    applyBuffs(map, site, false);

    expect(map.agriculture).toBe(0);
  });

  it("floors medium and small tidal agriculture settlements at 100%", () => {
    const map = createEconomyMap();
    const site = createTidallyLockedSite(BT.hmc);
    site.buildType = "picumnus";
    site.type = {
      buildClass: "settlement",
      inf: "agriculture" as Economy,
      orbital: false,
      tier: 1,
    } as SiteMap2["type"];

    applyBuffs(map, site, true);
    applyAgricultureSettlementFloor(map, site);

    expect(map.agriculture).toBe(1);
  });

  it("still applies tidal agriculture penalties to large agriculture settlements", () => {
    const map = createEconomyMap();
    const site = createTidallyLockedSite(BT.hmc);
    site.buildType = "fornax";
    site.type = {
      buildClass: "settlement",
      inf: "agriculture" as Economy,
      orbital: false,
      tier: 2,
    } as SiteMap2["type"];

    applyBuffs(map, site, true);
    applyAgricultureSettlementFloor(map, site);

    expect(map.agriculture).toBe(0.6);
  });
});

describe("calculateAgricultureStrongLinkContribution", () => {
  it("adds organics once and ignores terraformable when the feature flag is disabled", () => {
    const site = createStrongLinkSite([BodyFeature.bio, BodyFeature.terraformable]);

    expect(calculateAgricultureStrongLinkContribution(1, site, { enableTerraformableAgricultureBonus: false }).score).toBe(1.4);
  });

  it("includes terraformable bonus only when the feature flag is enabled", () => {
    const site = createStrongLinkSite([BodyFeature.bio, BodyFeature.terraformable]);

    expect(calculateAgricultureStrongLinkContribution(1, site).score).toBe(1.4);
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

  it("still applies ELW bonus for same-body agriculture facility strong links", () => {
    const site = createStrongLinkSite([], BT.elw);
    const source = {
      body: site.body,
      type: { inf: "agriculture" as Economy, tier: 1 },
    } as unknown as SiteMap2;

    expect(calculateAgricultureStrongLinkContribution(0.4, site, undefined, source).score).toBe(0.8);
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
        reason: expect.stringContaining("Apply weak link from: Weak agri source (source only"),
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
    expect(site.economyAudit!.filter(x => x.reason.includes("(source only") && x.delta === 0.05)).toHaveLength(2);
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
  it("propagates ground colony preset agriculture to an orbital colony on the same body", () => {
    const body = {
      features: [BodyFeature.atmosphere],
      name: "Test 1",
      num: 1,
      parents: [],
      type: BT.ib,
    };
    const sys = {
      bodies: [body],
      reserveLevel: "pristine",
    } as unknown as SysMap2;

    const surface = {
      body,
      economyAudit: [],
      id: "surface-atropos",
      buildType: "atropos",
      links: {
        economies: {},
        strongSites: [],
        weakSites: [],
      },
      name: "Surface Atropos",
      sys,
      type: {
        buildClass: "outpost",
        displayName2: "Civilian Surface Outpost",
        inf: "colony" as Economy,
        orbital: false,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(surface, []);

    expect(surface.intrinsic).toEqual(["industrial"]);
    expect(getColonyEconomyBeforeWeakLinks(surface, "agriculture")).toBe(0.55);
    expect(isGroundOrbitColonyPair(surface, {
      body,
      type: { inf: "colony" as Economy, orbital: true },
    } as unknown as SiteMap2)).toBe(true);

    const orbital = {
      body,
      economyAudit: [],
      id: "orbital-colony",
      links: {
        economies: {},
        strongSites: [surface],
        weakSites: [],
      },
      name: "Orbital colony",
      sys,
      type: {
        buildClass: "starport",
        inf: "colony" as Economy,
        orbital: true,
        tier: 2,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(orbital, ["surface-atropos"]);

    expect(orbital.economies!.agriculture).toBe(0.1);
    expect(orbital.economyAudit).toContainEqual(
      expect.objectContaining({
        delta: 0.1,
        inf: "agriculture",
        reason: expect.stringContaining("ground-orbit"),
      }),
    );
  });

  it("does not propagate ground colony preset agriculture to specialized fixed ports", () => {
    const body = {
      features: [BodyFeature.atmosphere],
      name: "Test 1",
      num: 1,
      parents: [],
      type: BT.ib,
    };
    const sys = {
      bodies: [body],
      reserveLevel: "pristine",
    } as unknown as SysMap2;

    const surface = {
      body,
      economyAudit: [],
      id: "surface-atropos",
      buildType: "atropos",
      links: {
        economies: {},
        strongSites: [],
        weakSites: [],
      },
      name: "Surface Atropos",
      sys,
      type: {
        buildClass: "outpost",
        displayName2: "Civilian Surface Outpost",
        inf: "colony" as Economy,
        orbital: false,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(surface, []);

    const orbital = {
      body,
      economyAudit: [],
      id: "orbital-industrial",
      links: {
        economies: {},
        strongSites: [surface],
        weakSites: [],
      },
      name: "Orbital industrial port",
      sys,
      type: {
        buildClass: "outpost",
        fixed: "industrial" as Economy,
        inf: "industrial" as Economy,
        orbital: true,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(orbital, ["surface-atropos"]);

    expect(orbital.economies!.agriculture).toBe(0);
  });

});

describe("agriculture link filters", () => {
  it("propagates intrinsic surface colony agriculture to a fixed orbital port on the same body", () => {
    const star = {
      features: [],
      name: "Test",
      num: 0,
      parents: [],
      type: BT.st,
    };
    const body = {
      features: [BodyFeature.bio, BodyFeature.tidal, BodyFeature.atmosphere],
      name: "Test 1",
      num: 1,
      parents: [0],
      type: BT.hmc,
    };
    const sys = {
      bodies: [star, body],
      reserveLevel: "pristine",
    } as unknown as SysMap2;

    const surface = {
      body,
      buildType: "zeus",
      economies: { ...createEconomyMap(), agriculture: 1.25, extraction: 1.25 },
      economyAudit: [],
      id: "surface-colony",
      intrinsic: ["agriculture", "extraction", "terraforming"],
      links: { economies: {}, strongSites: [], weakSites: [] },
      name: "Surface colony",
      primaryEconomy: "extraction" as Economy,
      sys,
      type: {
        buildClass: "outpost",
        inf: "colony" as Economy,
        orbital: false,
        tier: 3,
      },
    } as unknown as SiteMap2;

    const orbital = {
      body,
      economyAudit: [],
      id: "orbital-military",
      links: {
        economies: {},
        strongSites: [surface],
        weakSites: [],
      },
      name: "Orbital military port",
      sys,
      type: {
        buildClass: "outpost",
        fixed: "military" as Economy,
        inf: "military" as Economy,
        orbital: true,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(orbital, ["surface-colony"]);

    expect(orbital.economies!.agriculture).toBe(1.2);
    expect(orbital.economyAudit).toContainEqual(
      expect.objectContaining({
        inf: "agriculture",
        reason: expect.stringContaining("Apply colony Strong link from: Surface colony"),
      }),
    );
  });

  it("does not count distant ag-tourism colony hubs as agriculture weak-link sources", () => {
    const body = {
      features: [],
      name: "Test 1",
      num: 1,
      parents: [],
      type: BT.hmc,
    };
    const hubBody = {
      features: [],
      name: "Test 2",
      num: 2,
      parents: [],
      type: BT.ww,
    };
    const sys = {
      bodies: [body, hubBody],
      reserveLevel: "pristine",
    } as unknown as SysMap2;

    const agHub = {
      body: hubBody,
      buildType: "dec_truss",
      economies: { ...createEconomyMap(), agriculture: 1.4, tourism: 1.4 },
      economyAudit: [],
      id: "ag-hub",
      intrinsic: ["agriculture", "tourism"],
      name: "Ag tourism hub",
      primaryEconomy: "agriculture" as Economy,
      sys,
      type: {
        buildClass: "starport",
        inf: "colony" as Economy,
        orbital: true,
        tier: 3,
      },
    } as unknown as SiteMap2;

    const site = {
      body,
      economyAudit: [],
      id: "target",
      links: {
        economies: {},
        strongSites: [],
        weakSites: [agHub],
      },
      name: "Target port",
      sys,
      type: {
        buildClass: "starport",
        inf: "colony" as Economy,
        orbital: true,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(site, ["ag-hub"]);

    expect(site.economies!.agriculture).toBe(0);
  });
});

describe("agriculture weak link caps and floors", () => {
  it("caps agriculture weak links on HMC surface outposts without an agriculture intrinsic economy", () => {
    const site = createCivilianSurfaceOutpost("atropos", BT.hmc, [BodyFeature.landable, BodyFeature.tidal]);
    site.links!.weakSites = Array.from({ length: 12 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(0.3);
  });

  it("floors linked agriculture for orbital specialised ports below the common minimum", () => {
    const site = createFixedPortWithAgriLinks();
    site.type = {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: true,
      tier: 1,
    } as SiteMap2["type"];
    site.body!.type = BT.rb;
    site.links!.weakSites = Array.from({ length: 12 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(0.65);
  });

  it("floors linked agriculture for surface industrial ports only after substantial weak-link accumulation", () => {
    const lowAgSite = createFixedPortWithAgriLinks();
    lowAgSite.type = {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: false,
      tier: 1,
    } as SiteMap2["type"];
    lowAgSite.body!.type = BT.hmc;
    lowAgSite.links!.weakSites = Array.from({ length: 4 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(lowAgSite, lowAgSite.links!.weakSites.map(s => s.id));

    expect(lowAgSite.economies!.agriculture).toBe(0.2);

    const highAgSite = createFixedPortWithAgriLinks();
    highAgSite.type = {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: false,
      tier: 1,
    } as SiteMap2["type"];
    highAgSite.body!.type = BT.rb;
    highAgSite.links!.weakSites = Array.from({ length: 12 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(highAgSite, highAgSite.links!.weakSites.map(s => s.id));

    expect(highAgSite.economies!.agriculture).toBe(1);
  });

  it("still caps icy specialised ports with organics or tidal penalties at five agriculture weak links", () => {
    const site = createFixedPortWithAgriLinks();
    site.type = {
      buildClass: "outpost",
      fixed: "industrial" as Economy,
      inf: "industrial" as Economy,
      orbital: true,
      tier: 1,
    } as SiteMap2["type"];
    site.body!.type = BT.ib;
    site.body!.features.push(BodyFeature.bio, BodyFeature.tidal);
    site.links!.weakSites = Array.from({ length: 12 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(0.25);
  });

  it("caps agriculture weak links on surface colonies without an agriculture intrinsic economy", () => {
    const starA = {
      features: [],
      name: "Star A",
      num: 1,
      parents: [],
      type: BT.st,
    };
    const starB = {
      features: [],
      name: "Star B",
      num: 2,
      parents: [],
      type: BT.st,
    };
    const bodyA = {
      features: [],
      name: "Moon A",
      num: 10,
      parents: [1],
      type: BT.rb,
    };
    const bodyB1 = {
      features: [],
      name: "Moon B1",
      num: 20,
      parents: [2],
      type: BT.hmc,
    };
    const bodyB2 = {
      features: [],
      name: "Moon B2",
      num: 21,
      parents: [2],
      type: BT.hmc,
    };
    const sys = {
      bodies: [starA, starB, bodyA, bodyB1, bodyB2],
      reserveLevel: "pristine",
    } as unknown as SysMap2;
    const site = {
      body: bodyA,
      economyAudit: [],
      id: "surface-colony",
      links: {
        economies: {},
        strongSites: [],
        weakSites: [
          { ...createWeakSite("ag-a1", "agriculture" as Economy), body: bodyA },
          { ...createWeakSite("ag-b1", "agriculture" as Economy), body: bodyB1 },
          { ...createWeakSite("ag-b2", "agriculture" as Economy), body: bodyB2 },
        ],
      },
      name: "Surface colony",
      sys,
      type: {
        buildClass: "outpost",
        inf: "colony" as Economy,
        orbital: false,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(0.1);
    expect(site.economyAudit!.filter(entry => entry.inf === "agriculture")).toHaveLength(2);
  });

  it("caps agriculture weak links at 23 for plutus orbital ports with three or more strong subordinates", () => {
    const site = createCivilianSurfaceOutpost("plutus", BT.rb);
    site.type = {
      buildClass: "starport",
      inf: "colony" as Economy,
      orbital: true,
      tier: 1,
    } as SiteMap2["type"];
    site.links!.strongSites = [
      createWeakSite("sub-1", "extraction" as Economy),
      createWeakSite("sub-2", "industrial" as Economy),
      createWeakSite("sub-3", "refinery" as Economy),
    ];
    site.links!.weakSites = Array.from({ length: 30 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(1.15);
    expect(site.economyAudit!.filter(entry => entry.reason.startsWith("Apply weak link"))).toHaveLength(23);
    expect(site.economyAudit!.filter(entry => entry.reason.startsWith("Skipped weak link"))).toHaveLength(7);
  });

  it("caps agriculture weak links at 18 on plutus orbital ports with no strong subordinates", () => {
    const site = createCivilianSurfaceOutpost("plutus", BT.rb);
    site.type = {
      buildClass: "starport",
      inf: "colony" as Economy,
      orbital: true,
      tier: 1,
    } as SiteMap2["type"];
    site.links!.weakSites = Array.from({ length: 30 }, (_, i) =>
      createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
    );

    calculateColonyEconomies2(site, site.links!.weakSites.map(s => s.id));

    expect(site.economies!.agriculture).toBe(0.9);
    expect(site.economyAudit!.filter(entry => entry.reason.startsWith("Apply weak link"))).toHaveLength(18);
    expect(site.economyAudit!.filter(entry => entry.reason.startsWith("Skipped weak link"))).toHaveLength(12);
  });

  it("allows 22 agriculture weak links after same-body agriculture strong links", () => {
    const body = {
      features: [],
      name: "Moon",
      num: 1,
      parents: [],
      type: BT.rb,
    };
    const sys = { bodies: [body], reserveLevel: "pristine" } as unknown as SysMap2;
    const agSettlement = {
      body,
      buildType: "ceres",
      economies: { ...createEconomyMap(), agriculture: 1 },
      id: "ag-settlement",
      name: "Ag settlement",
      type: {
        buildClass: "settlement",
        inf: "agriculture" as Economy,
        orbital: false,
        tier: 2,
      },
    } as unknown as SiteMap2;
    const site = {
      body,
      economyAudit: [],
      id: "port",
      links: {
        economies: {},
        strongSites: [agSettlement],
        weakSites: Array.from({ length: 30 }, (_, i) =>
          createWeakSite(`agriculture-${i}`, "agriculture" as Economy),
        ),
      },
      name: "Port",
      sys,
      type: {
        buildClass: "starport",
        inf: "colony" as Economy,
        orbital: true,
        tier: 1,
      },
    } as unknown as SiteMap2;

    calculateColonyEconomies2(site, ["ag-settlement", ...site.links!.weakSites.map(s => s.id)]);

    expect(site.economies!.agriculture).toBe(2.1);
  });
});

