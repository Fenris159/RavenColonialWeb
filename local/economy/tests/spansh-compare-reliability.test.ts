import { isSpanshCompareExcluded, isUndockableFacility } from "./spansh-compare-reliability";

describe("Spansh compare reliability", () => {
  it("excludes only sites with no landing pads", () => {
    expect(isSpanshCompareExcluded({ padSize: "none" })).toBe(true);
    expect(isSpanshCompareExcluded({ padSize: "small" })).toBe(false);
    expect(isSpanshCompareExcluded({ padSize: "medium" })).toBe(false);
    expect(isSpanshCompareExcluded({ padSize: "large" })).toBe(false);
  });

  it("treats pad-bearing outposts and installations as dockable", () => {
    expect(isUndockableFacility({ buildClass: "outpost", padSize: "medium" })).toBe(false);
    expect(isUndockableFacility({ buildClass: "installation", padSize: "small" })).toBe(false);
    expect(isUndockableFacility({ buildClass: "installation", padSize: "none" })).toBe(true);
  });
});
