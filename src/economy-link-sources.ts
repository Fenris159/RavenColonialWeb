import type { BodyMap2, SiteMap2 } from "./system-model2";
import { BT, Bod } from "./types2";

/** Agriculture installations that can strong-link ports on sibling moons under the same gas giant. */
export const GAS_GIANT_CLUSTER_AG_INSTALLATION_BUILD_TYPES = new Set(["demeter", "picumnus"]);

/** Nearest gas-giant body num along `body.parents`, if any. */
export const getGasGiantParentNum = (body: Bod | undefined, allBodies: Bod[]): number | undefined => {
  if (!body?.parents?.length) {
    return undefined;
  }

  for (const parentNum of body.parents) {
    if (parentNum <= 0) {
      continue;
    }
    const parent = allBodies.find(b => b.num === parentNum);
    if (parent?.type === BT.gg) {
      return parent.num;
    }
  }

  return undefined;
};

/** True when two bodies orbit the same gas giant (sibling moons / cluster). */
export const bodiesShareGasGiantParent = (
  a: Bod | undefined,
  b: Bod | undefined,
  allBodies: Bod[],
): boolean => {
  if (!a || !b) {
    return false;
  }
  if (a.num === b.num) {
    return true;
  }

  const ggA = getGasGiantParentNum(a, allBodies);
  const ggB = getGasGiantParentNum(b, allBodies);
  return ggA !== undefined && ggA === ggB;
};

export const isGasGiantClusterAgricultureInstallation = (s: SiteMap2): boolean =>
  s.type.buildClass === "installation" &&
  s.type.inf === "agriculture" &&
  GAS_GIANT_CLUSTER_AG_INSTALLATION_BUILD_TYPES.has(s.buildType);

/**
 * Sibling-moon farm strong links attach to the body primary only (orbital primary when both exist).
 * Subordinate ports under a hub use the shared weak pool, not cluster farm strong links.
 */
export const bodyPrimaryReceivesGasGiantClusterAgStrongLinks = (
  body: BodyMap2,
  primarySite: SiteMap2,
): boolean => {
  if (primarySite !== body.orbitalPrimary && primarySite !== body.surfacePrimary) {
    return false;
  }
  if (body.orbitalPrimary) {
    return primarySite === body.orbitalPrimary;
  }
  return primarySite === body.surfacePrimary;
};

/**
 * demeter / picumnus on other moons under the same gas giant as `hostBody`.
 * Mirrors athena comms walking ancestor bodies — cluster agriculture for the body primary port.
 */
export const findGasGiantClusterAgricultureInstallations = (
  hostBody: BodyMap2,
  bodyMap: Record<string, BodyMap2>,
  allBodies: Bod[],
  calcIds: string[],
): SiteMap2[] => {
  if (getGasGiantParentNum(hostBody, allBodies) === undefined) {
    return [];
  }

  return Object.values(bodyMap)
    .filter(bm => bodiesShareGasGiantParent(hostBody, bm, allBodies))
    .flatMap(bm => bm.sites)
    .filter(
      s =>
        s.body !== hostBody &&
        calcIds.includes(s.id) &&
        isGasGiantClusterAgricultureInstallation(s),
    );
};

/** Same-body subordinate ports/hubs that qualify as weak-link sources (not already direct strong children). */
export const findSameBodyWeakLinkCandidates = (
  siblingSites: SiteMap2[],
  primarySite: SiteMap2,
  calcIds: string[],
  siteContributesWeakLinks: (s: SiteMap2) => boolean,
): SiteMap2[] =>
  siblingSites.filter(
    s =>
      s !== primarySite &&
      calcIds.includes(s.id) &&
      siteContributesWeakLinks(s),
  );
