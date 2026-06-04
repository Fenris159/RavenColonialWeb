import { Economy, EconomyMap } from "./site-data";
import { applyAgricultureBodyBuffs, calculateAgricultureStrongLinkContribution } from "./economy-ag-modifiers";
import {
  getAgricultureStrongLinkSourceValue,
  getColonyAgricultureStrongLinkSourceValue,
  getForeignStarAgricultureWeakLinkRoot,
  getMaxAgricultureWeakLinkBudget,
  getMaxAgricultureWeakLinks,
  isAgPrimaryHabWorldColony,
  shouldApplyAgricultureWeakLink,
  shouldApplyForeignStarAgricultureWeakLink,
  WEAK_LINK_AGRICULTURE_DELTA,
} from "./economy-ag-heuristics";
import {
  USE_NEW_MODEL,
  adjust,
  matches,
  noteAgricultureStrongLinkApplied,
  noteSkippedWeakLink,
  stellarRemnants,
} from "./economy-core";
import type { EconomyModelOptions } from "./economy-core";
import { siteContributesWeakLinks } from "./economy-weak-links";
import type { SiteMap2 } from "./system-model2";
import { BodyFeature } from "./types";
import { BT } from "./types2";

export const applySpecializedPort = (map: EconomyMap, site: SiteMap2) => {
  if (!site.type.fixed || site.type.fixed === 'none' || site.type.fixed === 'colony') {
    console.warn(`Why are we in: applySpecializedPort?`);
    return;
  }

  if (site.type.orbital) {
    adjust(site.type.fixed, +1.0, 'Specialised orbital economy', map, site);
  } else {
    adjust(site.type.fixed, +0.5, 'Specialised surface economy', map, site);
  }

  if (USE_NEW_MODEL) {
    applyBuffs(map, site, false);
  }
};

export const applyBodyType = (map: EconomyMap, site: SiteMap2) => {
  if (site.type.inf !== 'colony') {
    console.warn(`Why are we in: applyBodyType?`);
    return;
  }
  const intrinsic = new Set<Economy>();

  switch (site.body?.type) {
    default:
      console.warn(`Unexpected body type: "${site.body?.type}"`);
      return;

    case BT.un:
      break;
    case BT.bh:
    case BT.ns:
    case BT.wd:
      adjust('hightech', +1, 'Body type: BH/NS/WD', map, site); intrinsic.add('hightech');
      adjust('tourism', +1, 'Body type: BH/NS/WD', map, site); intrinsic.add('tourism');
      break;
    case BT.st:
      adjust('military', +1, 'Body type: STAR', map, site); intrinsic.add('military');
      break;
    case BT.elw:
      adjust('agriculture', +1, 'Body type: ELW', map, site); intrinsic.add('agriculture');
      adjust('hightech', +1, 'Body type: ELW', map, site); intrinsic.add('hightech');
      adjust('military', +1, 'Body type: ELW', map, site); intrinsic.add('military');
      adjust('tourism', +1, 'Body type: ELW', map, site); intrinsic.add('tourism');
      break;
    case BT.ww:
      adjust('agriculture', +1, 'Body type: WW', map, site); intrinsic.add('agriculture');
      adjust('tourism', +1, 'Body type: WW', map, site); intrinsic.add('tourism');
      break;
    case BT.aw:
      adjust('hightech', +1, 'Body type: AMMONIA', map, site); intrinsic.add('hightech');
      adjust('tourism', +1, 'Body type: AMMONIA', map, site); intrinsic.add('tourism');
      break;
    case BT.gg:
    case BT.wg:
      adjust('hightech', +1, 'Body type: GG/WG', map, site); intrinsic.add('hightech');
      adjust('industrial', +1, 'Body type: GG/WG', map, site); intrinsic.add('industrial');
      break;
    case BT.hmc:
    case BT.mrb:
      adjust('extraction', +1, 'Body type: HMC', map, site); intrinsic.add('extraction');
      break;
    case BT.ri:
      adjust('industrial', +1, 'Body type: ROCKY-ICE', map, site); intrinsic.add('industrial');
      adjust('refinery', +1, 'Body type: ROCKY-ICE', map, site); intrinsic.add('refinery');
      break;
    case BT.rb:
      adjust('refinery', +1, 'Body type: ROCKY', map, site); intrinsic.add('refinery');
      break;
    case BT.ib:
      adjust('industrial', +1, 'Body type: ICY', map, site); intrinsic.add('industrial');
      break;
    case BT.ac:
      adjust('extraction', +1, 'Body type: ASTEROID', map, site); intrinsic.add('extraction');
      break;
  }

  if (site.body?.name && [BT.st, ...stellarRemnants].includes(site.body?.type)) {
    const hasAsteroids = site.sys.bodies.some(b => b.type === BT.ac && b.name.startsWith(site.body!.name));
    if (hasAsteroids) {
      adjust('extraction', +1, 'Star has: ASTEROIDs', map, site); intrinsic.add('extraction');
    }
  }

  if (site.body.features.includes(BodyFeature.rings)) {
    if (![BT.hmc, BT.mrb].includes(site.body?.type)) {
      adjust('extraction', +1, 'Body has: RINGS', map, site, 'body'); intrinsic.add('extraction');
    }
  }

  if (site.body.features.includes(BodyFeature.bio)) {
    if (![BT.elw, BT.ww].includes(site.body?.type)) {
      adjust('agriculture', +1, 'Body has: BIO', map, site, 'body'); intrinsic.add('agriculture');
    }
    adjust('terraforming', +1, 'Body has: BIO', map, site, 'body'); intrinsic.add('terraforming');
  }

  if (site.body.features.includes(BodyFeature.geo)) {
    if (![BT.hmc, BT.mrb].includes(site.body?.type)) {
      adjust('extraction', +1, 'Body has: GEO', map, site, 'body'); intrinsic.add('extraction');
    }
    if (![BT.gg, BT.wg, BT.ri, BT.ib].includes(site.body?.type)) {
      adjust('industrial', +1, 'Body has: GEO', map, site, 'body'); intrinsic.add('industrial');
    }
  }

  site.intrinsic = Array.from(intrinsic);
};

export const getColonyEconomyBeforeWeakLinks = (site: SiteMap2, inf: keyof EconomyMap) => {
  return (site.economyAudit ?? [])
    .filter(entry => entry.inf === inf && !entry.reason.includes('weak link'))
    .reduce((sum, entry) => sum + entry.delta, 0);
};

/** Weak links applied during the latest economy calc (from audit trail). */
export const getAppliedWeakLinkCount = (site: SiteMap2, inf: keyof EconomyMap) => {
  return (site.economyAudit ?? [])
    .filter(entry => entry.inf === inf && entry.reason.startsWith('Apply weak link'))
    .length;
};

const applyStrongAgricultureContribution = (
  map: EconomyMap,
  site: SiteMap2,
  sourceValue: number,
  prefix: string,
  sourceSite: SiteMap2,
  options?: EconomyModelOptions,
) => {
  const contribution = calculateAgricultureStrongLinkContribution(sourceValue, site, options, sourceSite);
  if (contribution.score <= 0) {
    return;
  }

  adjust(
    'agriculture',
    contribution.score,
    `Apply ${prefix} from: ${sourceSite.name} (T${sourceSite.type.tier}): ${contribution.formula}`,
    map,
    site,
  );
  noteAgricultureStrongLinkApplied(site, sourceSite, prefix);
};

/** Top-level uses the source inf; nested sub-strong uses the parent link economy (`subLink`). */
const resolveStrongLinkEconomy = (subLink: Economy | '*' | undefined, sourceInf: Economy): Economy =>
  subLink !== undefined && subLink !== '*' ? subLink : sourceInf;

const shouldApplyStrongLinkEconomy = (
  subLink: Economy | '*' | undefined,
  economy: Economy,
): boolean => subLink === undefined || subLink === '*' || economy === subLink;

/** Fixed outposts / shared-pool ports subordinate to an economy-bearing hub (athena, enodia, …). */
const receivesParentHubSubStrong = (site: SiteMap2): boolean => {
  if (!site.parentLink) {
    return false;
  }
  if (site.type.fixed && site.type.fixed !== "none" && site.type.fixed !== "colony") {
    return true;
  }
  if (site.type.inf === "colony" && !site.type.fixed) {
    return true;
  }
  return false;
};

/**
 * Subordinates listed under a hub (e.g. Garcia under Rintaro) contribute sub-strong to other
 * receivers on the body (orbital primary). The subordinate port should receive the same tier-sized
 * sub-strong from its parent hub once the linked economy exists on the port map.
 */
export const applyParentHubSubStrongLink = (
  map: EconomyMap,
  site: SiteMap2,
  calcIds: string[],
) => {
  const parent = site.parentLink;
  if (!parent || !receivesParentHubSubStrong(site) || !calcIds.includes(parent.id)) {
    return;
  }

  const parentInf = parent.type.inf;
  if (parentInf === "none" || parentInf === "colony") {
    return;
  }

  const infSize = site.type.tier === 1 ? 0.4 : site.type.tier === 2 ? 0.8 : 1.2;
  if (!(parentInf in map)) {
    return;
  }

  adjust(
    parentInf,
    infSize,
    `Apply sub-strong link from parent: ${parent.name} (T${site.type.tier})`,
    map,
    site,
  );
  applyStrongLinkBoost(parentInf, map, site, "sub-strong link");
};

export const applyStrongLinks2 = (
  map: EconomyMap,
  strongSites: SiteMap2[],
  site: SiteMap2,
  calcIds: string[],
  subLink?: Economy | '*',
  options?: EconomyModelOptions,
) => {
  const isSubStrongPass = subLink !== undefined;

  for (let s of strongSites) {
    if (s.type.inf === 'none') { continue; }
    if (!calcIds.includes(s.id)) { continue; }
    if (isSubStrongPass && s === site) { continue; }

    const infSize = s.type.tier === 1 ? 0.4 : (s.type.tier === 2 ? 0.8 : 1.2);
    const prefix = isSubStrongPass ? 'sub-strong link' : 'Strong link';

    if (s.type.inf !== 'colony') {
      const infToApply = resolveStrongLinkEconomy(subLink, s.type.inf);
      if (!shouldApplyStrongLinkEconomy(subLink, infToApply)) {
        continue;
      }
      if (infToApply in map) {
        if (infToApply === 'agriculture') {
          applyStrongAgricultureContribution(
            map,
            site,
            getAgricultureStrongLinkSourceValue(s, infSize),
            prefix,
            s,
            options,
          );
        } else {
          adjust(infToApply, infSize, `Apply ${prefix} from: ${s.name} (T${s.type.tier})`, map, site);
          applyStrongLinkBoost(infToApply, map, site, prefix);
        }
      } else if (!isSubStrongPass) {
        console.warn(`Unknown economy '${s.type.inf}' for site ${s.name} - ${s.type.displayName2} (${s.buildType})`);
      }

      if (s.links?.strongSites && !subLink) {
        applyStrongLinks2(map, s.links?.strongSites, site, calcIds, s.type.inf, options);
      }
      continue;
    }

    if (!s.primaryEconomy) {
      console.warn(`Why no primaryEconomy yet for '${s.name}' generating for: ${site.name} ?`);
      continue;
    }

    for (var e in s.economies) {
      const ee = e as keyof EconomyMap;
      if (s.intrinsic?.includes(ee)) {
        if (!shouldApplyStrongLinkEconomy(subLink, ee)) {
          continue;
        }
        if (site.type.fixed && ee !== site.type.fixed) {
          if (!(ee === 'agriculture' && canInheritGroundOrbitColonyAgriculture(s, site))) {
            continue;
          }
        }

        const colonyInfSize = s.type.tier === 1 ? 0.4 : (s.type.tier === 2 ? 0.8 : 1.2);
        if (ee === 'agriculture') {
          applyStrongAgricultureContribution(
            map,
            site,
            getColonyAgricultureStrongLinkSourceValue(s, site, colonyInfSize, getColonyEconomyBeforeWeakLinks),
            `colony ${prefix}`,
            s,
            options,
          );
        } else {
          adjust(ee, colonyInfSize, `Apply colony ${prefix} from: ${s.name} (T${s.type.tier})`, map, site);
          applyStrongLinkBoost(ee, map, site, `${prefix}s`);
        }
      }
    }

    if (
      !subLink &&
      !site.type.fixed &&
      isGroundOrbitColonyPair(s, site) &&
      !s.intrinsic?.includes('agriculture')
    ) {
      const sourceAg = getColonyEconomyBeforeWeakLinks(s, 'agriculture');
      if (sourceAg > 0) {
        applyStrongAgricultureContribution(map, site, infSize, `colony ${prefix} ground-orbit`, s, options);
      }
    }

    if (s.links?.strongSites && !subLink) {
      applyStrongLinks2(map, s.links?.strongSites, site, calcIds, "*", options);
    }
  }
};

export const isSameBodySurfaceToOrbitalPair = (source: SiteMap2, target: SiteMap2) => {
  return source.type.inf === 'colony' &&
    !source.type.orbital &&
    !!target.type.orbital &&
    source.body === target.body;
};

export const isGroundOrbitColonyPair = (source: SiteMap2, target: SiteMap2) => {
  return isSameBodySurfaceToOrbitalPair(source, target) && target.type.inf === 'colony';
};

export const canInheritGroundOrbitColonyAgriculture = (source: SiteMap2, target: SiteMap2) => {
  if (!isSameBodySurfaceToOrbitalPair(source, target)) {
    return false;
  }

  if (!source.intrinsic?.includes('agriculture')) {
    return false;
  }

  if (target.type.fixed && source.primaryEconomy === target.type.fixed) {
    return false;
  }

  return true;
};

export const applyStrongLinkBoost = (inf: Economy, map: EconomyMap, site: SiteMap2, reason: string) => {
  const reserveLevel = site.sys.reserveLevel ?? 'pristine';

  switch (inf) {
    default: return 0;

    case 'extraction':
      if (matches(["major", "pristine"], reserveLevel)) {
        adjust(inf, +0.4, `+ ${reason} boost: System reserveLevel is MAJOR or PRISTINE`, map, site, 'sys');
      }
      else if (matches(["depleted", "low"], reserveLevel)) {
        adjust(inf, -0.4, `- ${reason} boost: System reserveLevel is LOW or DEPLETED`, map, site, 'sys');
      }
      if (matches([BodyFeature.volcanism], site.body?.features)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body has VOLCANISM`, map, site, 'body');
      }
      return;

    case 'hightech':
      if (matches([BT.aw, BT.elw, BT.ww], site.body?.type)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body is AW/ELW/WW`, map, site, 'body');
      }
      if (matches([BodyFeature.bio], site.body?.features)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body has BIO`, map, site, 'body');
      }
      if (matches([BodyFeature.geo], site.body?.features)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body has GEO`, map, site, 'body');
      }
      return;

    case 'industrial':
    case 'refinery':
      if (matches(["major", "pristine"], reserveLevel)) {
        adjust(inf, +0.4, `+ ${reason} boost: System reserveLevel is MAJOR or PRISTINE`, map, site, 'sys');
      }
      else if (matches(["depleted", "low"], reserveLevel)) {
        adjust(inf, -0.4, `- ${reason} boost: System reserveLevel is LOW or DEPLETED`, map, site, 'sys');
      }
      return;

    case 'tourism':
      if (matches([BT.aw, BT.elw, BT.ww], site.body?.type)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body is AW/ELW/WW`, map, site, 'body');
      }
      if (matches([BodyFeature.bio], site.body?.features)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body has BIO`, map, site, 'body');
      }
      if (matches([BodyFeature.geo], site.body?.features)) {
        adjust(inf, +0.4, `+ ${reason} boost: Body has GEO`, map, site, 'body');
      }
      if (site.sys.bodies.some(b => b.type === BT.ns)) {
        adjust(inf, +0.4, `+ ${reason} boost: System has Neutron Star`, map, site, 'sys');
      }
      if (site.sys.bodies.some(b => b.type === BT.bh)) {
        adjust(inf, +0.4, `+ ${reason} boost: System has Black Hole`, map, site, 'sys');
      }
      if (site.sys.bodies.some(b => b.type === BT.wd)) {
        adjust(inf, +0.4, `+ ${reason} boost: System has White Dwarf`, map, site, 'sys');
      }
      return;
  }
};

export type ApplyBuffsOptions = { /** Scientific/medical hubs: Spansh ignores BIO/GEO hightech body buffs */ skipHightechBodyBuffs?: boolean };

export const applyBuffs = (map: EconomyMap, site: SiteMap2, isSettlement: boolean, options?: ApplyBuffsOptions) => {
  const reserveLevel = site.sys.reserveLevel ?? 'pristine';

  const reserveSensitiveEconomies = ['industrial', 'extraction', 'refinery'] as (keyof EconomyMap)[];
  for (const key of reserveSensitiveEconomies) {
    if (map[key] > 0) {
      if (reserveLevel === 'major' || reserveLevel === 'pristine') {
        adjust(key, +0.4, 'Buff: reserveLevel MAJOR or PRISTINE', map, site, 'sys');
      } else if ((reserveLevel === 'low' || reserveLevel === 'depleted') && !isSettlement) {
        adjust(key, -0.4, 'Buff: reserveLevel LOW or DEPLETED', map, site, 'sys');
      }
    }
  }

  applyAgricultureBodyBuffs(map, site, adjust);

  if (map.hightech > 0 && !options?.skipHightechBodyBuffs) {
    if (isSettlement && USE_NEW_MODEL) {
      if (matches([BodyFeature.bio], site.body?.features)) {
        adjust('hightech', +0.4, 'Buff: body has BIO', map, site, 'body');
      }
      if (matches([BodyFeature.geo], site.body?.features)) {
        adjust('hightech', +0.4, 'Buff: body has GEO', map, site, 'body');
      }
      if (matches([BT.elw, BT.aw], site.body?.type)) {
        adjust('hightech', +0.4, 'Buff: body is ELW or AW', map, site, 'body');
      }
    } else {
      if (matches([BodyFeature.bio, BodyFeature.geo], site.body?.features)) {
        adjust('hightech', +0.4, 'Buff: body has BIO or GEO', map, site, 'body');
      } else if (matches([BT.elw, BT.aw], site.body?.type)) {
        adjust('hightech', +0.4, 'Buff: body is ELW or AW', map, site, 'body');
      }
    }
  }

  if (map.extraction > 0) {
    if (matches([BodyFeature.volcanism], site.body?.features)) {
      adjust('extraction', +0.4, 'Buff: body has VOLCANISM', map, site, 'body');
    }
  }

  if (map.tourism > 0) {
    if (site.sys.bodies.some(b => b.type === BT.bh)) {
      adjust('tourism', +0.4, 'Buff: system has a Black Hole', map, site, 'sys');
    }
    if (site.sys.bodies.some(b => b.type === BT.bh)) {
      adjust('tourism', +0.4, 'Buff: system has a Neutron Star', map, site, 'sys');
    }
    if (site.sys.bodies.some(b => b.type === BT.wd)) {
      adjust('tourism', +0.4, 'Buff: system has a White Dwarf', map, site, 'sys');
    }
    if (!site.bodyBuffed?.has('tourism')) {
      if (matches([BodyFeature.bio, BodyFeature.geo], site.body?.features)) {
        adjust('tourism', +0.4, 'Buff: body has BIO or GEO', map, site, 'body');
      } else if (matches([BT.elw, BT.ww, BT.aw], site.body?.type)) {
        adjust('tourism', +0.4, 'Buff: body is ELW or WW or AW', map, site, 'body');
      }
    }
  }
};

export const applyWeakLinks = (map: EconomyMap, site: SiteMap2, calcIds: string[]) => {
  if (!site.links?.weakSites) { return; }

  let agricultureWeakLinksApplied = 0;
  const agPrimaryHabWorld = isAgPrimaryHabWorldColony(site, map);
  const maxAgricultureWeakLinkBudget = getMaxAgricultureWeakLinkBudget(site, agPrimaryHabWorld);
  const maxAgricultureWeakLinks = getMaxAgricultureWeakLinks(site, agPrimaryHabWorld);
  const homeStarRoot = getForeignStarAgricultureWeakLinkRoot(site);
  const foreignStarAgWeakLinksUsed = new Set<number>();

  // Stable source order — link graph lists all candidates; budgets stop accumulation (game: +5% steps).
  const orderedWeakSites = [...site.links.weakSites].sort((a, b) => a.name.localeCompare(b.name));

  for (let s of orderedWeakSites) {
    if (!calcIds.includes(s.id)) { continue; }
    if (!siteContributesWeakLinks(s)) { continue; }

    let inf = s.type.inf;
    if (inf === 'none') { continue; }

    const skipAgricultureIfCapped = (sourceName: string, intrinsicSourceOnly = false) => {
      if (agricultureWeakLinksApplied < maxAgricultureWeakLinks) {
        return false;
      }
      const sourceLabel = intrinsicSourceOnly ? 'intrinsic source only, ' : '';
      noteSkippedWeakLink(
        'agriculture',
        `Skipped weak link from: ${sourceName} (${sourceLabel}cap reached, budget ${Math.round(maxAgricultureWeakLinkBudget * 100)}%)`,
        map,
        site,
      );
      return true;
    };

    if (inf === 'colony') {
      if (!s.primaryEconomy) {
        console.warn(`Why no primaryEconomy yet for '${s.name}' generating for: ${site.name} ?`);
        continue;
      }

      for (const instrinsicInf of s.intrinsic ?? []) {
        if (instrinsicInf === 'agriculture') {
          if (!shouldApplyAgricultureWeakLink(s, site)) { continue; }
          if (!shouldApplyForeignStarAgricultureWeakLink(s, site, homeStarRoot, foreignStarAgWeakLinksUsed)) { continue; }
          if (skipAgricultureIfCapped(s.name, true)) { continue; }
          adjust(
            instrinsicInf,
            WEAK_LINK_AGRICULTURE_DELTA,
            `Apply weak link from: ${s.name} (intrinsic source only, budget ${Math.round(maxAgricultureWeakLinkBudget * 100)}%)`,
            map,
            site,
          );
          agricultureWeakLinksApplied++;
        } else {
          adjust(instrinsicInf, WEAK_LINK_AGRICULTURE_DELTA, `Apply weak link from: ${s.name} (intrinsic)`, map, site);
        }
      }
      continue;
    }

    if (inf in map) {
      if (inf === 'agriculture') {
        if (!shouldApplyAgricultureWeakLink(s, site)) { continue; }
        if (!shouldApplyForeignStarAgricultureWeakLink(s, site, homeStarRoot, foreignStarAgWeakLinksUsed)) { continue; }
        if (skipAgricultureIfCapped(s.name)) { continue; }
        adjust(
          inf,
          WEAK_LINK_AGRICULTURE_DELTA,
          `Apply weak link from: ${s.name} (source only, budget ${Math.round(maxAgricultureWeakLinkBudget * 100)}%)`,
          map,
          site,
        );
        agricultureWeakLinksApplied++;
      } else {
        adjust(inf, WEAK_LINK_AGRICULTURE_DELTA, `Apply weak link from: ${s.name}`, map, site);
      }
    } else {
      console.warn(`Unknown economy '${s.type.inf}' for site '${s.name}', generating for: ${site.name}`);
    }
  }
};
