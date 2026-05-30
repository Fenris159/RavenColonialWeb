import type { SiteMap2 } from "./system-model2";

const isTieredStation = (s: SiteMap2): boolean => {
  return (s.type.buildClass === 'starport' || s.type.buildClass === 'outpost')
    && s.type.tier >= 1 && s.type.tier <= 3;
};

/** T1/T2/T3 starports and outposts only contribute weak links when subordinate to another station. */
export const siteContributesWeakLinks = (s: SiteMap2): boolean => {
  if (s.type.inf === 'none') { return false; }
  if (s === s.body?.orbitalPrimary || s === s.body?.surfacePrimary) { return false; }
  if (isTieredStation(s) && s.parentLink === undefined) { return false; }
  return true;
};
