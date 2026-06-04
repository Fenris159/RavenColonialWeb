import type { SiteMap2 } from "./system-model2";

const isTieredStation = (s: SiteMap2): boolean => {
  return (s.type.buildClass === 'starport' || s.type.buildClass === 'outpost')
    && s.type.tier >= 1 && s.type.tier <= 3;
};

const isHubWeakContributor = (s: SiteMap2): boolean =>
  s.type.buildClass === "hub" && s.type.inf !== "none";

/** T1/T2/T3 ports only contribute weak links when subordinate; hubs when subordinate. Installations use strong links only. */
export const siteContributesWeakLinks = (s: SiteMap2): boolean => {
  if (s.type.inf === 'none') { return false; }
  if (s.type.buildClass === 'installation') { return false; }
  if (s === s.body?.orbitalPrimary || s === s.body?.surfacePrimary) { return false; }
  if (isTieredStation(s) && s.parentLink === undefined) { return false; }
  if (isHubWeakContributor(s) && s.parentLink === undefined) { return false; }
  return true;
};
