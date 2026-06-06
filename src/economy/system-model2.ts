import { SysSnapshot } from '../api/v2-system';
import { calculateColonyEconomies2, calculateFacilityEconomies2, EconomyModelOptions, isFacilityWithEconomy, stellarRemnants } from './economy-model2';
import type { AgEconomyCalcFlags } from './economy-core';
import {
  bodyPrimaryReceivesGasGiantClusterAgStrongLinks,
  findGasGiantClusterAgricultureInstallations,
  findSameBodyWeakLinkCandidates,
  flattenHubGrandchildStrongSites,
} from './economy-link-sources';
import { siteAlreadyStrongLinkedTo, siteContributesWeakLinks } from './economy-weak-links';
import { canReceiveLinks, ConcreteEconomy, Economy, getSiteType, mapName, SiteType, SysEffects, sysEffects } from "../site-data";
import { BodyFeature } from '../types';
import { Bod, BT, Site, Sys } from '../types2';

export const unknown = 'Unknown';

export type SysUnlocks =
  | 'SettlementTourist'
  | 'InstallationTourist'
  | 'InstallationScientific'
  | 'InstallationMilitary'
  | 'HubCivilian'
  | 'HubMilitary'
  | 'HubExploration'
  | 'HubOutpost'
  | 'HubIndustrial'
  | 'HubExtraction'

  | 'ShipyardT1'
  | 'OutfittingNonMilOutpost'
  | 'OutfittingT1Surface'
  | 'VistaGenomics'
  | 'UniversalCartographics'
  | 'MarketOutposts'
  | 'CrewLounge'
  ;

export const mapSysUnlocks: Record<SysUnlocks, { icon: string, title: string, needTypes: string[], needs: string }> = {
  'SettlementTourist': {
    icon: 'Suitcase', title: 'Tourist Settlements', needTypes: ["hermes", "angelia", "eirene"], // a satellite
    needs: 'A satellite',
  },
  'InstallationTourist': {
    icon: 'Cocktails', title: 'Tourist Installations', needTypes: ["aergia", "comus", "gelos", "fufluns"], // a tourist settlement
    needs: 'A tourist settlement',
  },
  'InstallationScientific': {
    icon: 'NetworkTower', title: 'Scientific Installations', needTypes: ["pheobe", "asteria", "caerus", "chronos"], // a bio settlement
    needs: 'A bio settlement',
  },
  'InstallationMilitary': {
    icon: 'Shield', title: 'Military Installations', needTypes: ["ioke", "bellona", "enyo", "polemos", "minerva"], // a military settlement
    needs: 'A military settlement',
  },
  'HubMilitary': {
    icon: 'ReportHacked', title: 'Military Hub', needTypes: ["vacuna", "alastor"], // a military installation
    needs: 'A military installation',
  },
  'HubCivilian': {
    icon: 'Home', title: 'Civilian Hub', needTypes: ["consus", "picumnus", "annona", "ceres", "fornax"], // an agricultural settlement
    needs: 'An agricultural settlement',
  },
  'HubExploration': {
    icon: 'Camera', title: 'Exploration Hub', needTypes: ["pistis", "soter", "aletheia"], // comms
    needs: 'A comms installation',
  },
  'HubOutpost': {
    icon: 'HardDriveGroup', title: 'Outpost Hub', needTypes: ['demeter'], // a space farm
    needs: 'A space farm',
  },
  'HubIndustrial': {
    icon: 'Manufacturing', title: 'Industrial Hub', needTypes: ["euthenia", "phorcys"], // mining/industrial installation
    needs: 'A mining/industrial installation',
  },
  'HubExtraction': {
    icon: 'Diamond', title: 'Extraction Hub', needTypes: ["ourea", "mantus", "orcus", "aerecura", "erebus"], // extraction settlement
    needs: 'An extraction settlement',
  },

  'ShipyardT1': {
    icon: 'Airplane', title: 'Shipyard at T1 surface ports', needTypes: [
      "eunostus", "molae", "tellus_i", // industrial hub
      "vacuna", "alastor",// military installation
    ], needs: 'An industrial hub or military installation',
  },
  'OutfittingNonMilOutpost': {
    icon: 'Dataflows', title: 'Outfitting at non-Military Outposts', needTypes: [
      "janus", // high-tech hub
      "vacuna", "alastor", // military installation
    ], needs: 'A high-tech hub or military installation',
  },
  'OutfittingT1Surface': {
    icon: 'FlowChart', title: 'Outfitting at non-Industrial T1 surface ports', needTypes: [
      "janus", // high-tech hub
      "vacuna", "alastor", // military installation
    ], needs: 'A high-tech hub or military installation',
  },
  'VistaGenomics': {
    icon: 'ClassroomLogo', title: 'Vista Genomics at T1 Surface or T2 orbital ports', needTypes: [
      "asclepius", "eupraxia", // a Medical Installation
      "athena", "caelus", // scientific hub
    ], needs: 'A scientific hub or medical installation',
  },
  'UniversalCartographics': {
    icon: 'HomeGroup', title: 'Universal Cartographics at T1 Surface or T2 orbital ports', needTypes: [
      "astraeus", "coeus", "dione", "dodona", // a Medical Installation
      "tellus_e", // exploration hub
    ], needs: 'An exploration hub or research installation',
  },
  'MarketOutposts': {
    icon: 'Shop', title: 'Commodities at Pirate, Scientific or Military Outposts', needTypes: [
      "bacchus", "dionysus", // space bar
      "hedone", "opora", "pasithea", // tourist installation
      "io", // outpost hub
    ], needs: 'An outpost hub, tourist installation or space bar',
  },
  'CrewLounge': {
    icon: 'People', title: 'Crew Lounge at non-Civilian T1 ports', needTypes: ["bacchus", "dionysus"], // space bar
    needs: 'A space bar',
  },
};

/** Mid-build system map: bodies/sites grouped; tier totals and economies not computed yet. */
interface SysMapBuild extends Sys {
  siteMaps: SiteMap2[];
  bodyMap: Record<string, BodyMap2>;
  countSites: number;
  systemScore: number;
  calcIds: string[];
}

export interface SysMap2 extends SysMapBuild {
  tierPoints: TierPoints;
  economies: Record<string, number>;
  sumEffects: SysEffects;
  sysUnlocks: Record<SysUnlocks, boolean>;
  taxCount: number;
}

export interface TierPoints {
  tier2: number;
  tier3: number;
}

export interface BodyMap2 extends Bod {
  sites: SiteMap2[];
  surface: SiteMap2[];
  orbital: SiteMap2[];

  surfacePrimary?: SiteMap2;
  orbitalPrimary?: SiteMap2;
}

export interface AuditEconomy {
  inf: string;
  delta: number;
  reason: string;
  before: number;
  after: number;
}

export interface SiteMap2 extends Site {
  original: Site;
  sys: SysMap2;
  type: SiteType;
  links?: SiteLinks2;
  /** Economies generated for Colony types */
  economies?: EconomyMap;
  intrinsic?: Economy[];
  economyAudit?: AuditEconomy[];
  /** Top generated economy generated for Colony types */
  primaryEconomy?: Economy;
  parentLink?: SiteMap2;
  body?: BodyMap2;

  bodyBuffed?: Set<Economy>;
  systemBuffed?: Set<Economy>;

  /** Agriculture calculation flags; reset each time economies are calculated. */
  agEconomyCalc?: AgEconomyCalcFlags;

  /** Internal guard for economy dependency pre-calculation. */
  economyCalcState?: "pending" | "calculating" | "done";

  /** Calculated points needed to start construction */
  calcNeeds?: { tier: number; count: number; }
}

export type EconomyMap = Record<Exclude<Economy, 'colony' | 'none'>, number>;

export interface SiteLinks2 {
  economies: Record<string, EconomyLink>
  strongSites: SiteMap2[];
  /** Cross-body weak-link candidates (all economies). */
  weakSites: SiteMap2[];
  /** Same-body subordinate weak sources — agriculture weak links only at apply time. */
  sameBodyWeakSites?: SiteMap2[];
}

export interface EconomyLink {
  strong: number;
  weak: number;
}

export const buildSystemModel2 = (sys: Sys, useIncomplete: boolean, buffNerf?: boolean, economyModelOptions?: EconomyModelOptions): SysMap2 => {
  const idxLimit = sys.idxCalcLimit ?? sys.sites.length;

  // the primary port is always the first site
  sys.primaryPortId = sys.sites?.length > 0
    ? sys.sites[0].id
    : undefined;

  sys = { ...sys };
  sys.sites = sys.sites.map(s => { return { ...s }; });

  // Read:
  // https://forums.frontier.co.uk/threads/constructing-a-specific-economy.637363/

  // group sites by their bodies, extract system and architect names
  const sysMap = initializeSysMap(sys, useIncomplete, idxLimit);

  // determine primary ports for each body
  const allBodies = Object.values(sysMap.bodyMap);
  for (const body of allBodies) {
    body.surfacePrimary = getBodyPrimaryPort(body.surface, sysMap.calcIds, body.sites);
    const siblingSites = findSiblingSites(sys.bodies, sysMap.bodyMap, body, !!body.surfacePrimary);
    body.orbitalPrimary = getBodyPrimaryPort(siblingSites, sysMap.calcIds, body.sites);
  }

  // assign subordinate links before weak-link sources are collected (sheet: tiered stations only weak-link when subordinate)
  for (const body of allBodies) {
    assignBodySubordinateLinks(sys.bodies, sysMap.bodyMap, body, sysMap.calcIds);
  }

  for (const site of sysMap.siteMaps) {
    if (site.status === 'demolish' || !sysMap.calcIds.includes(site.id)) { continue; }
    if (usesGeneratedColonyEconomy(site) || isFacilityWithEconomy(site)) {
      site.economyCalcState = "pending";
    }
  }

  // per body, calc strong/weak links
  for (const body of allBodies) {
    calcBodyLinks(sysMap.bodyMap, body, sys, sysMap.calcIds, economyModelOptions);
  }

  // calc sum effects from all sites
  const { tierPoints, taxCount } = sumTierPoints(sysMap.siteMaps, sysMap.calcIds, !useIncomplete);
  const sumEffects = sumSystemEffects(sysMap.siteMaps, sysMap.calcIds, buffNerf, economyModelOptions);

  // calc system unlocks
  const sysUnlocks = {} as Record<SysUnlocks, boolean>;
  for (let key of Object.keys(mapSysUnlocks) as SysUnlocks[]) {
    const unlocked = sysMap.sites.some(s => (sysMap.calcIds.includes(s.id)) && mapSysUnlocks[key].needTypes.some(n => s.buildType?.startsWith(n)));
    sysUnlocks[key] = unlocked;
  }

  // re-sort bodies by their num value
  // sys.bodies.sort((a, b) => a.num - b.num);

  const finalMap: SysMap2 = {
    ...sysMap,
    ...sumEffects,
    tierPoints,
    taxCount,
    sysUnlocks,
  };

  for (const s of sysMap.siteMaps) {
    s.sys = finalMap;
  }

  return finalMap;
};

const starsAndClusters = [...stellarRemnants, BT.ac, BT.st];

const findSiblingSites = (bods: Bod[], bodyMap: Record<string, BodyMap2>, body: BodyMap2, onlyOrbitals: boolean) => {
  // skip logic below if body is not a star or an asteroid cluster
  if (!starsAndClusters.includes(body.type)) { return [...onlyOrbitals ? body.orbital : body.sites]; }

  // find parent, if we aren't it
  const parent = body.type !== BT.ac
    ? body
    : bods.find(b => b.num === body.parents[0]);
  if (!parent) {
    console.error(`Why no parent for: ${body.name}`);
    return [];
  }

  const bodies = [parent, ...bods.filter(b => b.type === BT.ac && parent.num === b.parents[0])];
  const siblingSites = bodies.flatMap(x => x.name in bodyMap ? onlyOrbitals ? bodyMap[x.name].orbital : bodyMap[x.name].sites : []);
  return siblingSites;
};

export const getUnknownBody = (): Bod => {
  return {
    name: 'Unknown',
    num: -1,
    distLS: -1,
    features: [BodyFeature.landable],
    parents: [],
    subType: 'Unknown',
    type: BT.un,
    radius: -1,
    temp: -1,
    gravity: -1,
  };
}

const initializeSysMap = (sys: Sys, useIncomplete: boolean, idxLimit: number): SysMapBuild => {

  let siteMaps: SiteMap2[] = [];
  let systemScore = 0;

  const calcIds = useIncomplete
    ? sys.sites.filter((s, i) => i < idxLimit && s.status !== 'demolish').map(s => s.id) // include up to idxLimit
    : sys.sites.filter(s => s.status === 'complete').map(s => s.id); // include only completed sites

  // first: group sites by their bodies
  if (!sys.sites) { sys.sites = []; }
  const bodyMap = sys.sites.reduce((map, s) => {
    let bodyNum = s.bodyNum ?? -1;
    const rawBody = sys.bodies.find(b => b.num === bodyNum) ?? getUnknownBody();

    let body = map[rawBody.name];
    if (!body) {
      body = {
        ...rawBody,
        sites: [], surface: [], orbital: [],
      };
      map[rawBody.name] = body;
    }

    // create site entry and add to bodies surface/orbital collection
    const site: SiteMap2 = {
      ...s,
      original: s,
      sys: sys as SysMap2,
      body: body as BodyMap2,
      type: getSiteType(s.buildType, true)!,
    };
    siteMaps.push(site);
    body.sites.push(site);

    if (site.status !== 'demolish') {
      if (site.type.orbital) {
        body.orbital.push(site);
      } else {
        body.surface.push(site);
      }
    }

    if (calcIds.includes(site.id)) {
      systemScore += site.type.score ?? 0;
    }
    return map;
  }, {} as Record<string, BodyMap2>);

  const countSites = sys.sites.length;
  const sysMap: SysMapBuild = {
    ...sys,
    siteMaps,
    bodyMap,
    countSites,
    systemScore,
    calcIds,
  };

  for (const s of siteMaps) {
    s.sys = sysMap as unknown as SysMap2;
  }

  return sysMap;
};

/** log a diagnostic audit for the system score - completed sites only */
export const getSysScoreDiagnostic = (sys: Sys, siteMaps: SiteMap2[]) => {

  const lines: string[][] = [];
  lines.push(['score', 'type', 'sub-type', 'site name', 'body name']);

  let score = 0;
  Array.from(siteMaps)
    .filter(site => site.status === 'complete')
    .sort((a, b) => a.type.displayName2.localeCompare(b.type.displayName2) || a.buildType?.localeCompare(b.buildType))
    .forEach(site => {
      score += site.type.score ?? 0;
      lines.push([
        `  +${site.type.score ?? '■'}`,
        site.type.displayName2,
        site.buildType,
        site.name,
        site.body?.name || sys.name,
      ]);
    });

  const cw = lines.reduce((m, l) => {
    for (let n = 0; n < 5; n++) {
      m[n] = Math.max(m[n], l[n]?.length ?? 0);
    }
    return m;
  }, [0, 0, 0, 0, 0])

  lines.splice(1, 0, cw.map(n => '-'.repeat(n)));
  lines.push(cw.map(n => '-'.repeat(n)));

  let scoreTxt = lines.map(l => {
    return l.map((c, i) => (c ?? '?').padEnd(cw[i])).join(' | ');
  })
    .join(`\n`);

  scoreTxt += `\n` + `= ${score}`.padEnd(cw[0]) + ` | ${sys.name}\n\n`;
  // console.log(`\n${scoreTxt}\n`);
  return scoreTxt;
};

export const sumTierPoints = (siteMaps: SiteMap2[], calcIds: string[], incBuildStarted?: boolean) => {

  const tierPoints: TierPoints = { tier2: 0, tier3: 0 };
  const primaryPortId = siteMaps && siteMaps[0]?.id;

  let taxCount = -2;
  for (const site of siteMaps) {
    if (site.status === 'demolish') { continue; }
    // skip mock sites, unless ...
    if (incBuildStarted) {
      // allow status:build or complete even though they may not be in calcIds
      if (site.status === 'plan') { continue; }
    } else if (!calcIds.includes(site.id)) { continue; }

    // sum system tier points needed - these are already spent for projects in-progress
    if (site.id !== primaryPortId && site.type.needs.count > 0 && site.type.needs.tier > 1) {
      let needCount = site.type.needs.count;
      if (site.type.buildClass === 'starport' && site.type.tier > 1) {
        taxCount++;
        needCount = applyTax(site.type.tier, needCount, taxCount);
      }

      const tierName = site.type.needs.tier === 2 ? 'tier2' : 'tier3';
      tierPoints[tierName] -= needCount;
      // store this on the site itself, so we can display these adjusted costs
      site.calcNeeds = { tier: site.type.needs.tier, count: needCount };
    }

    // skip incomplete sites, unless ...
    if (!calcIds.includes(site.id)) { continue; }

    // sum system tier points given
    if (site.type.gives.count > 0 && site.type.gives.tier > 1) {
      const tierName = site.type.gives.tier === 2 ? 'tier2' : 'tier3';
      tierPoints[tierName] += site.type.gives.count;
    }
  }

  return { tierPoints, taxCount };
}

export const applyTax = (tier: number, cost: number, taxCount: number) => {
  if (taxCount > 0) {
    if (tier === 3) {
      const delta = cost * taxCount; // cost * 100%
      cost += delta;
    } else {
      const delta = Math.trunc((cost * 0.75) * taxCount); // cost * 75%, but removing any fractional amount
      cost += delta;
    }
  }
  return cost;
};

const sumSystemEffects = (siteMaps: SiteMap2[], calcIds: string[], buffNerf?: boolean, economyModelOptions?: EconomyModelOptions) => {

  const mapEconomies: Record<string, number> = {};
  const sumEffects: SysEffects = {};

  let first = true;
  for (const site of siteMaps) {
    if (site.status === 'demolish') { continue; }

    // skip incomplete sites, unless ...
    if (!calcIds.includes(site.id)) continue;

    ensureSiteEconomiesCalculated(site, calcIds, economyModelOptions);
    const inf = site.primaryEconomy ?? site.type.inf;

    if (inf !== 'none') {
      mapEconomies[inf] = (mapEconomies[inf] ?? 0) + 1;
    }

    // sum total system effects
    for (const key of sysEffects) {
      let effect = site.type.effects[key] ?? 0;
      if (effect === 0) continue;
      if (buffNerf) {
        effect = adjustAfflictedStarPortSumEffect(key, effect, first);
      }
      sumEffects[key] = (sumEffects[key] ?? 0) + effect;
    }

    first = false;
  }

  // sort: highest count first, or alpha if equal
  const sorted = Object.keys(mapEconomies).sort((a, b) => {
    if (mapEconomies[b] === mapEconomies[a]) {
      return b.localeCompare(a);
    } else {
      return mapEconomies[b] - mapEconomies[a];
    }
  });
  const economies: Record<string, number> = {};
  sorted.forEach(key => economies[key] = mapEconomies[key]);

  // work-around JS floating point nonense
  for (const k in sumEffects) {
    const v = sumEffects[k as keyof SysEffects]!;
    sumEffects[k as keyof SysEffects] = parseFloat((v * 1000).toFixed()) / 1000;
  }

  return {
    economies,
    sumEffects,
  };
}

const adjustAfflictedStarPortSumEffect = (key: keyof SysEffects, effect: number, isInitial: boolean) => {
  switch (key) {
    case 'pop':
    case 'mpop':
      // no impact
      return effect;

    case 'dev': return isInitial ? effect + effect * 0.4 : effect - effect * 0.1; // +40% or -10%
    case 'sec': return isInitial ? effect + effect * 0.4 : effect - effect * 0.1; // +40% or -10%
    case 'sol': return isInitial ? effect + effect * 0.4 : effect - effect * 0.2; // +40% or -20%
    case 'tech': return isInitial ? effect + effect * 0.2 : effect - effect * 0.25; // +20% or -25%
    case 'wealth': return isInitial ? effect + effect * 0.4 : effect - effect * 0.25; // +40% or -25%
  }
}

/** Dockable ports anchor link graphs; hubs only when the body has no port; installations never. */
const canActAsBodyLinkPrimary = (s: SiteMap2, bodyHasDockablePort: boolean): boolean => {
  if (s.type.buildClass === "installation") {
    return false;
  }
  if (canReceiveLinks(s.type)) {
    return true;
  }
  if (s.type.buildClass === "hub" && s.type.inf !== "none") {
    return !bodyHasDockablePort;
  }
  return false;
};

const pickPrimaryByTier = (
  sites: SiteMap2[],
  tier: number,
  bodyHasDockablePort: boolean,
): SiteMap2 | undefined => {
  const matches = sites.filter(
    s => s.type.tier === tier && canActAsBodyLinkPrimary(s, bodyHasDockablePort),
  );
  // Dockable ports beat hubs/installations at the same tier when picking body primary.
  const port = matches.find(s => canReceiveLinks(s.type));
  if (port) {
    return port;
  }
  return matches.length > 0 ? matches[0] : undefined;
};

const getBodyPrimaryPort = (
  sites: SiteMap2[],
  calcIds: string[],
  allBodySites: SiteMap2[],
): SiteMap2 | undefined => {
  if (sites.length === 0) return undefined;

  if (calcIds.length) {
    sites = sites.filter(s => calcIds.includes(s.id));
  }

  const bodyHasDockablePort = allBodySites.some(
    s => (!calcIds.length || calcIds.includes(s.id)) && canReceiveLinks(s.type),
  );

  for (const tier of [3, 2, 1] as const) {
    const primary = pickPrimaryByTier(sites, tier, bodyHasDockablePort);
    if (primary) {
      return primary;
    }
  }

  return undefined;
}

/** Whether a port/outpost on a body shares the primary's system-wide weak-link pool. */
const siteSharesPrimaryLinkPool = (site: SiteMap2): boolean => {
  if (site.type.inf === "none") {
    return false;
  }
  // Multi-economy colony ports (non-fixed intrinsic)
  if (site.type.inf === "colony" && !site.type.fixed) {
    return true;
  }
  // Fixed specialized outposts (bia, fauna, vulcan, …) still accumulate linked economies in-game
  if (site.type.fixed && site.type.fixed !== "none" && site.type.fixed !== "colony") {
    return true;
  }
  return false;
};

/** Non-primary ports/outposts on a body use the same link candidate pool as the body primary. */
const shareColonyLinkPoolFromPrimary = (
  body: BodyMap2,
  primarySite: SiteMap2 | undefined,
  calcIds: string[],
) => {
  if (!primarySite?.links) {
    return;
  }

  const { weakSites, sameBodyWeakSites = [] } = primarySite.links;
  for (const site of body.sites) {
    if (site === primarySite || site.links) {
      continue;
    }
    if (!calcIds.includes(site.id) || site.status === "demolish") {
      continue;
    }
    if (!["starport", "outpost"].includes(site.type.buildClass)) {
      continue;
    }
    if (!siteSharesPrimaryLinkPool(site)) {
      continue;
    }

    const strongSitesForSite = site.type.fixed
      ? buildSharedStrongSitesForPort(body, site, primarySite, body.surfacePrimary, body.orbitalPrimary)
      : body.sites.filter(s => s.parentLink === site);
    const excludeSelf = (list: SiteMap2[]) => list.filter(s => s.id !== site.id);
    site.links = {
      economies: {},
      strongSites: strongSitesForSite,
      weakSites: excludeSelf([...weakSites]),
      sameBodyWeakSites: excludeSelf([...sameBodyWeakSites]),
    };
  }
};

/** Same-body subordinates of this port plus strong-link sources from body primaries (surface + orbital). */
const buildSharedStrongSitesForPort = (
  body: BodyMap2,
  site: SiteMap2,
  linkPrimary: SiteMap2,
  surfacePrimary?: SiteMap2,
  orbitalPrimary?: SiteMap2,
): SiteMap2[] => {
  const seen = new Set<string>();
  const add = (list: SiteMap2[]) => {
    for (const s of list) {
      if (s === site || seen.has(s.id)) {
        continue;
      }
      seen.add(s.id);
      out.push(s);
    }
  };
  const out: SiteMap2[] = [];
  add(body.sites.filter(s => s.parentLink === site));
  for (const primary of [surfacePrimary, orbitalPrimary]) {
    if (primary?.links?.strongSites && primary !== linkPrimary) {
      add(primary.links.strongSites);
    }
  }
  if (linkPrimary.links?.strongSites) {
    add(linkPrimary.links.strongSites);
  }
  return out;
};

const calcBodyLinks = (bodyMap: Record<string, BodyMap2>, body: BodyMap2, sys: Sys, calcIds: string[], economyModelOptions?: EconomyModelOptions) => {

  // exit early if no primary port for this body
  if (!body.surfacePrimary && !body.orbitalPrimary) { return; }

  // Calc link graphs for surface then orbital; then share pools once both exist.
  if (body.surfacePrimary) {
    calcSiteLinks(sys.bodies, bodyMap, body, body.surfacePrimary, calcIds);
  }
  if (body.orbitalPrimary) {
    calcSiteLinks(sys.bodies, bodyMap, body, body.orbitalPrimary, calcIds);
  }
  const linkPoolPrimary = body.surfacePrimary ?? body.orbitalPrimary;
  if (linkPoolPrimary) {
    shareColonyLinkPoolFromPrimary(body, linkPoolPrimary, calcIds);
  }

  // then calculate the economies after that
  for (const site of body.sites) {
    calcSiteEconomies(site, calcIds, economyModelOptions);
}
}

/** T1/T2/T3 starports and outposts only contribute weak links when subordinate to another station. */
export { siteAlreadyStrongLinkedTo, siteContributesWeakLinks } from './economy-weak-links';

const canBeSubordinateToPrimary = (
  s: SiteMap2,
  primarySite: SiteMap2,
  body: BodyMap2,
  calcIds: string[],
): boolean => {
  if (s.parentLink || s.type.inf === 'none' || s === primarySite || (!calcIds.includes(s.id))) {
    return false;
  }

  if (!primarySite.type.orbital && s.type.orbital && (s.type.buildClass === 'outpost' || s.type.buildClass === 'starport')) {
    // surface sites cannot claim orbital ports
    return false;
  }

  if (s.type.orbital && !primarySite.type.orbital && !!body.orbitalPrimary) {
    // surface sites cannot claim orbital facilities if there's an orbital port
    return false;
  }

  if (s.type.buildClass === "installation") {
    if (canReceiveLinks(primarySite.type)) {
      return true;
    }
    if (primarySite.type.buildClass === "hub") {
      return true;
    }
  }

  if (primarySite.type.buildClass === "hub" && s.type.buildClass === "hub") {
    return false;
  }

  if (primarySite.type.buildClass === "installation" && s.type.buildClass === "installation") {
    return s.type.orbital && !primarySite.type.orbital;
  }

  return true;
};

const assignBodySubordinateLinks = (bods: Bod[], bodyMap: Record<string, BodyMap2>, body: BodyMap2, calcIds: string[]) => {
  if (!body.surfacePrimary && !body.orbitalPrimary) { return; }

  if (body.surfacePrimary) {
    assignSubordinateLinks(bods, bodyMap, body, body.surfacePrimary, calcIds);
  }
  if (body.orbitalPrimary) {
    assignSubordinateLinks(bods, bodyMap, body, body.orbitalPrimary, calcIds);
  }
};

const assignSubordinateLinks = (bods: Bod[], bodyMap: Record<string, BodyMap2>, body: BodyMap2, primarySite: SiteMap2, calcIds: string[]) => {
  const siblingSites = findSiblingSites(bods, bodyMap, body, false);

  for (const s of siblingSites) {
    if (canBeSubordinateToPrimary(s, primarySite, body, calcIds)) {
      s.parentLink = primarySite;
    }
  }
};

const calcSiteLinks = (bods: Bod[], bodyMap: Record<string, BodyMap2>, body: BodyMap2, primarySite: SiteMap2, calcIds: string[]) => {

  // start with sites directly on the body
  const siblingSites = findSiblingSites(bods, bodyMap, body, false);

  // strong links: direct subordinates; sibling-moon farms strong-link the body primary only (orbital wins).
  const clusterAgInstallations = bodyPrimaryReceivesGasGiantClusterAgStrongLinks(body, primarySite)
    ? findGasGiantClusterAgricultureInstallations(body, bodyMap, bods, calcIds)
    : [];
  const strongSiteIds = new Set<string>();
  const strongSites = flattenHubGrandchildStrongSites(
    [
      ...siblingSites.filter(s => s.parentLink === primarySite),
      ...clusterAgInstallations,
    ]
      .filter(s => {
        if (strongSiteIds.has(s.id)) {
          return false;
        }
        strongSiteIds.add(s.id);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const strongGraph = { strongSites } as Pick<SiteLinks2, "strongSites">;
  const excludeStrongLinkedWeak = (list: SiteMap2[]) =>
    list.filter(s => !siteAlreadyStrongLinkedTo(s, { links: strongGraph } as SiteMap2));

  // Weak links: same-body subordinates/hubs, then other bodies (full candidate pool).
  // Economy calc applies +5% steps until the agriculture weak-link budget is exhausted.
  // When primarySite.original.weakLinkIds is set, only those sources are used (player-configured links).
  let sameBodyWeakSites = findSameBodyWeakLinkCandidates(
    siblingSites,
    primarySite,
    calcIds,
    siteContributesWeakLinks,
  );
  let weakSites = excludeStrongLinkedWeak(
    Object.values(bodyMap)
      .filter(b => b !== body)
      .flatMap(b => b.sites)
      .filter(s => !siblingSites.includes(s) && calcIds.includes(s.id) && siteContributesWeakLinks(s)),
  );
  sameBodyWeakSites = excludeStrongLinkedWeak(sameBodyWeakSites);

  const configuredWeakLinkIds = primarySite.original.weakLinkIds;
  if (configuredWeakLinkIds?.length) {
    const allowed = new Set(configuredWeakLinkIds);
    weakSites = weakSites.filter(s => allowed.has(s.id));
    sameBodyWeakSites = sameBodyWeakSites.filter(s => allowed.has(s.id));
  }

  if (!primarySite.links && (strongSites.length > 0 || weakSites.length > 0 || sameBodyWeakSites.length > 0)) {
    primarySite.links = {
      economies: {}, // we need to calculate strong/weak links across all sites before we can populate this
      strongSites,
      weakSites,
      sameBodyWeakSites,
    };
  }
}

const usesGeneratedColonyEconomy = (site: SiteMap2): boolean =>
  ['settlement', 'outpost', 'starport'].includes(site.type.buildClass);

const ensureSiteEconomiesCalculated = (
  s: SiteMap2,
  calcIds: string[],
  economyModelOptions?: EconomyModelOptions,
): boolean => {
  if (s.economyCalcState === "done") {
    return true;
  }
  if (s.economyCalcState === "calculating") {
    return false;
  }

  const shouldCalculateColonyEconomy = usesGeneratedColonyEconomy(s);
  const shouldCalculateFacilityEconomy = !shouldCalculateColonyEconomy && isFacilityWithEconomy(s);
  if (!shouldCalculateColonyEconomy && !shouldCalculateFacilityEconomy) {
    return true;
  }

  s.economyCalcState = "calculating";
  try {
    if (shouldCalculateColonyEconomy) {
      calculateColonyEconomies2(s, calcIds, economyModelOptions);
    } else {
      calculateFacilityEconomies2(s, calcIds, economyModelOptions);
    }
    s.economyCalcState = "done";
    return true;
  } finally {
    if (s.economyCalcState === "calculating") {
      delete s.economyCalcState;
    }
  }
};

const calcSiteEconomies = (site: SiteMap2, calcIds: string[], economyModelOptions?: EconomyModelOptions) => {
  if (!site.links) return;

  const map: Record<ConcreteEconomy, EconomyLink> = {
    'agriculture': { strong: 0, weak: 0 },
    'extraction': { strong: 0, weak: 0 },
    'industrial': { strong: 0, weak: 0 },
    'hightech': { strong: 0, weak: 0 },
    'tourism': { strong: 0, weak: 0 },
    'military': { strong: 0, weak: 0 },
    'service': { strong: 0, weak: 0 },
    'refinery': { strong: 0, weak: 0 },
    'terraforming': { strong: 0, weak: 0 },
  };
  for (const s of site.links.strongSites) {
    const inf = s.type.inf;
    if (inf === 'none') continue;
    // each supporting facility can provide up to one strong link of each economy type,
    // this mimicks the in-game UI behavior
    const curSiteLinks: Set<ConcreteEconomy> = new Set();
    if (inf === 'colony') {
      if (!ensureSiteEconomiesCalculated(s, calcIds, economyModelOptions)) {
        continue;
      }
      const pe = s.primaryEconomy;
      if (pe && pe !== 'none' && pe !== 'colony') {
        curSiteLinks.add(pe);
      }
    } else {
      ensureSiteEconomiesCalculated(s, calcIds, economyModelOptions);
      curSiteLinks.add(inf);
    }

    // Hub grandchildren already flattened into strongSites — avoid double-counting.
    for (const strongLink of s.links?.strongSites ?? []) {
      if (site.links.strongSites.some(top => top.id === strongLink.id)) {
        continue;
      }
      const linkInf = strongLink.type.inf;
      if (linkInf === 'none' || linkInf === 'colony') continue;
      curSiteLinks.add(linkInf);
    }

    for (const link of curSiteLinks) {
      map[link].strong++;
    }
  }

  const allWeakCandidates = [
    ...(site.links.sameBodyWeakSites ?? []),
    ...site.links.weakSites,
  ];
  for (const s of allWeakCandidates) {
    if (!siteContributesWeakLinks(s)) { continue; }
    if (siteAlreadyStrongLinkedTo(s, site)) { continue; }
    const inf = s.type.inf;
    if (inf === 'none') continue;
    if (inf === 'colony') {
      if (!ensureSiteEconomiesCalculated(s, calcIds, economyModelOptions)) {
        continue;
      }
      const pe = s.primaryEconomy;
      if (pe && pe !== 'none' && pe !== 'colony') {
        map[pe].weak++;
      }
    } else {
      ensureSiteEconomiesCalculated(s, calcIds, economyModelOptions);
      if (!map[inf]) { map[inf] = { strong: 0, weak: 0 }; }
      map[inf].weak++;
    }
  }

  // In-game link UI shows at most one weak slot per non-agriculture economy.
  for (const key of Object.keys(map) as ConcreteEconomy[]) {
    if (key !== 'agriculture' && map[key].weak > 1) {
      map[key].weak = 1;
    }
  }

  // sort by strong, then weak count, or alpha sort if all equal
  const sorted = (Object.keys(map) as Array<ConcreteEconomy>).sort((ka, kb) => {
    const a = map[ka];
    const b = map[kb];
    if (a.strong !== b.strong) {
      return b.strong - a.strong;
    } else if (a.weak !== b.weak) {
      return b.weak - a.weak;
    } else {
      return kb.localeCompare(ka);
    }
  });
  for (const key of sorted) {
    if (map[key].strong === 0 && map[key].weak === 0) { continue; }
    site.links.economies[key] = map[key];
  }
};

export interface SiteTypeValidity {
  isValid: boolean;
  msg?: string;
  unlocks?: string[];
}

export const isTypeValid2 = (sysMap: SysMap2 | undefined, type: SiteType | undefined, priorType: SiteType | undefined): SiteTypeValidity => {
  if (!type) { return { isValid: true }; }

  if (sysMap) {
    // give credit for points already spent for priorType
    let neededT2 = sysMap.tierPoints.tier2;
    let neededT3 = sysMap.tierPoints.tier3;
    if (priorType) {
      if (priorType.needs.tier === 2) { neededT2 += priorType.needs.count; }
      if (priorType.needs.tier === 3) { neededT3 += priorType.needs.count; }
    }

    if (type.needs.tier === 2 && neededT2 < type.needs.count) {
      return {
        isValid: false,
        msg: 'Not enough Tier 2 points',
        unlocks: type.unlocks,
      };
    }

    if (type.needs.tier === 3 && neededT3 < type.needs.count) {
      return {
        isValid: false,
        msg: 'Not enough Tier 3 points',
        unlocks: type.unlocks,
      };
    }
  }

  if (type.preReq) {
    const isValid = hasPreReq2(sysMap?.siteMaps, type);
    return {
      isValid: isValid,
      msg: 'Requires ' + mapName[type.preReq],
      unlocks: type.unlocks,
    };
  }

  if (type.unlocks) {
    return {
      isValid: true,
      unlocks: type.unlocks,
    };
  }

  return { isValid: true };
}

export const getPreReqNeeded = (type: SiteType): string[] => {

  switch (type.preReq) {
    case 'satellite': return ["hermes", "angelia", "eirene"];
    case 'comms': return ["pistis", "soter", "aletheia"];
    case 'settlementAgr': return ["consus", "picumnus", "annona", "ceres", "fornax"];
    case 'installationAgr': return ["demeter"];
    case 'installationMil': return ["vacuna", "alastor"];
    case 'outpostMining': return ["euthenia", "phorcys"];
    case 'relay': return ["enodia", "ichnaea"];
    case 'settlementBio': return ["pheobe", "asteria", "caerus", "chronos"];
    case 'settlementTourist': return ["aergia", "comus", "gelos", "fufluns"];
    case 'settlementMilitary': return ["ioke", "bellona", "enyo", "polemos", "minerva"];
    case 'settlementExtraction': return ["ourea", "mantus", "orcus", "aerecura", "erebus"];
    default:
      console.error(`Unexpected preReq: ${type.preReq}`)
      return [];
  }
}

export const hasPreReq2 = (siteMaps: SiteMap2[] | undefined, type: SiteType) => {
  if (!siteMaps) { return true; }

  const neededBuildTypes = getPreReqNeeded(type);
  return siteMaps.some(s => s.status !== 'demolish' && neededBuildTypes.some(n => s.buildType?.startsWith(n)));
}

export const getSnapshot = (newSys: Sys, isFav: boolean | undefined) => {
  // prepare a snapshot without using incomplete sites
  const snapshotFull = buildSystemModel2(newSys, false, true);
  const snapshot: SysSnapshot = {
    architect: newSys.architect,
    id64: newSys.id64,
    v: newSys.v,
    name: newSys.name,
    pos: newSys.pos,
    tierPoints: snapshotFull.tierPoints,
    sumEffects: snapshotFull.sumEffects,
    sites: newSys.sites,
    pop: newSys.pop,
    stale: false,
    score: snapshotFull.systemScore ?? -1,
    fav: isFav,
  };
  return snapshot;
};
