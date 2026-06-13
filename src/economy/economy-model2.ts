import { Economy, EconomyMap } from "../site-data";
import { SiteMap2 } from "./system-model2";
import { asPosNegTxt2 } from "../util";
import {
  applyObservedPresetEconomies,
  applyAgricultureSettlementFloor,
  applyFixedSurfaceAgricultureFloor,
  applyOrbitalFixedNonAgAgricultureFloor,
  getSettlementFixedEconomyValue,
} from "./economy-ag-heuristics";
import {
  EconomyModelOptions,
  USE_NEW_MODEL,
  adjust,
  resetAgEconomyCalc,
} from "./economy-core";
import {
  applyBodyType,
  applyBuffs,
  applyFixedPortPostLinkBodyBuffs,
  applyParentHubSubStrongLink,
  applySpecializedPort,
  applyStrongLinks2,
  applyWeakLinks,
} from "./economy-documented";
import { calculateFacilityEconomies2 } from "./economy-facilities";

export { calculateFacilityEconomies2, getFacilityFixedIntrinsic, isFacilityWithEconomy } from "./economy-facilities";

let showConsoleAudit = Date.now() < 0;

export type { EconomyModelOptions };
export { stellarRemnants } from "./economy-core";
export {
  applyBodyType,
  applyBuffs,
  applyStrongLinkBoost,
  applyParentHubSubStrongLink,
  applyStrongLinks2,
  canInheritGroundOrbitColonyAgriculture,
  getColonyEconomyBeforeWeakLinks,
  getAppliedWeakLinkCount,
  getAppliedWeakLinkSources,
  isGroundOrbitColonyPair,
  isSameBodySurfaceToOrbitalPair,
} from "./economy-documented";
export { bodyIsTidalToStar } from "./economy-core";
export { calculateAgricultureStrongLinkContribution } from "./economy-ag-modifiers";

export const calculateColonyEconomies2 = (site: SiteMap2, calcIds: string[], options?: EconomyModelOptions): Economy => {
  site.economyAudit = [];
  site.bodyBuffed = undefined;
  site.systemBuffed = undefined;
  resetAgEconomyCalc(site);

  const map = {
    agriculture: 0,
    extraction: 0,
    hightech: 0,
    industrial: 0,
    military: 0,
    refinery: 0,
    terraforming: 0,
    tourism: 0,
    service: 0,
  } as EconomyMap;

  switch (site.type.buildClass) {
    default:
      console.error(`Unexpected buildClass: ${site.type.buildClass}`);
      return 'none';

    case 'hub':
    case 'installation':
      return calculateFacilityEconomies2(site, calcIds, options);

    case 'unknown':
      console.warn('Why are we here?');
      return 'none';

    case 'settlement': {
      const intrinsic = getSettlementFixedEconomyValue(site);
      adjust(site.type.inf, intrinsic, "Odyssey settlement fixed economy", map, site);
      applyBuffs(map, site, true, options);
      applyAgricultureSettlementFloor(map, site);
      return finishUp(map, site);
    }

    case 'outpost':
    case 'starport':
      break;
  }

  if (site.type.fixed) {
    applySpecializedPort(map, site);
  } else {
    if (!site.type.orbital || site.body?.surfacePrimary?.type.inf !== 'colony' || site !== site.body?.orbitalPrimary || USE_NEW_MODEL) {
      applyBodyType(map, site);
    }

    if (USE_NEW_MODEL) {
      applyBuffs(map, site, false, options);
    }

    applyObservedPresetEconomies(map, site);
  }

  if (site.links) {
    const strongBoostApplied = new Set<Economy>();
    applyStrongLinks2(map, site.links.strongSites, site, calcIds, undefined, options, strongBoostApplied);
    applyParentHubSubStrongLink(map, site, calcIds, strongBoostApplied);
    applyWeakLinks(map, site, calcIds);
    applyFixedSurfaceAgricultureFloor(map, site);
    applyOrbitalFixedNonAgAgricultureFloor(map, site);
    applyFixedPortPostLinkBodyBuffs(map, site);
  }

  return finishUp(map, site);
};

const finishUp = (map: EconomyMap, site: SiteMap2) => {
  const primaryEconomy = Object.keys(map).sort((a, b) => {
    return map[b as keyof EconomyMap] - map[a as keyof EconomyMap];
  })[0] as Economy;

  site.economies = map;
  site.primaryEconomy = primaryEconomy;

  const sorted = site.economyAudit!.sort((a, b) => a.inf.localeCompare(b.inf));
  if (showConsoleAudit) {
    const auditTxt = sorted
      .map((x, i) => {
        let t = `${x.inf.padStart(12)}: \t${asPosNegTxt2(x.delta).padEnd(4, '0')} \t ${x.reason}`;
        if (sorted[i + 1]?.inf !== x.inf) {
          t += `\n${x.inf.padStart(12)}: \t= ${x.after.toFixed(2)}\n`;
        }
        return t;
      })
      .join('\n');

    var finalTally = Object.entries(map)
      .filter(([k, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `\t${k.padEnd(12)}: ${v.toFixed(2)}`)
      .join('\n');

    console.log(`*** ${site.name} (${site.buildType}) ***\n\n${auditTxt}\n\nFinal tally:\n${finalTally}\n\n`);
  }

  site.economyAudit!
    .sort((a, b) => map[b.inf as keyof EconomyMap] - map[a.inf as keyof EconomyMap]);

  return site.primaryEconomy!;
};
