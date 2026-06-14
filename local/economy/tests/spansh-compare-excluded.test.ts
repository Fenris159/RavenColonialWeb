import {
  isSpanshCompareExcluded,
  isUndockableFacility,
} from "../../../src/economy/compare/spansh-compare-reliability";
import { resolveSpanshEconomyForSite } from "../../../src/economy/compare/spansh-economy-resolve";
import type { GetRealEconomies } from "../../../src/api/v2-system";

const SPANSH_ROW: GetRealEconomies = {
  id: 4364923907,
  updated: "2026-06-04 14:00:21+00",
  economies: { military: 100 },
};

describe("Spansh compare exclusions", () => {
  it("excludes only sites with no landing pads", () => {
    expect(isSpanshCompareExcluded({ padSize: "none" })).toBe(true);
    expect(isSpanshCompareExcluded({ padSize: "small" })).toBe(false);
    expect(isSpanshCompareExcluded({ padSize: "medium" })).toBe(false);
    expect(isSpanshCompareExcluded({ padSize: "large" })).toBe(false);
  });

  it("does not resolve Spansh for no-pad sites", () => {
    const edsm = { "fort snailing": 4364923907 };
    expect(
      resolveSpanshEconomyForSite(
        { name: "Fort Snailing", status: "complete", buildClass: "hub", padSize: "none" },
        [SPANSH_ROW],
        edsm,
      ),
    ).toBeNull();
  });

  it("resolves Spansh for pad-bearing hubs, installations, and outposts", () => {
    const edsm = { "fort snailing": 4364923907 };
    expect(
      resolveSpanshEconomyForSite(
        { name: "Fort Snailing", status: "complete", buildClass: "hub", padSize: "large" },
        [SPANSH_ROW],
        edsm,
      ),
    ).not.toBeNull();
    expect(
      resolveSpanshEconomyForSite(
        { name: "Fort Snailing", status: "complete", buildClass: "installation", padSize: "small" },
        [SPANSH_ROW],
        edsm,
      ),
    ).not.toBeNull();
    expect(
      resolveSpanshEconomyForSite(
        { name: "Fort Snailing", status: "complete", buildClass: "outpost", padSize: "medium" },
        [SPANSH_ROW],
        edsm,
      ),
    ).not.toBeNull();
  });

  it("treats no-pad sites as undockable", () => {
    expect(
      isUndockableFacility({ buildClass: "installation", padSize: "none" }),
    ).toBe(true);
    expect(
      isUndockableFacility({ buildClass: "outpost", padSize: "medium" }),
    ).toBe(false);
  });
});
