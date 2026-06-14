import {
  applySpanshInversionReorder,
  type SpanshInversionHints,
} from "../../../src/economy/compare/spansh-inversion-detect";

describe("BuildOrder market inversion reorder", () => {
  it("swaps each recommended inversion pair once", () => {
    const hints: SpanshInversionHints = {
      a: {
        siteId: "a",
        swapWithSiteId: "c",
        swapWithSiteName: "C",
        direction: "down",
        confidence: "exact",
        reasons: ["test"],
      },
      c: {
        siteId: "c",
        swapWithSiteId: "a",
        swapWithSiteName: "A",
        direction: "up",
        confidence: "exact",
        reasons: ["test"],
      },
      b: {
        siteId: "b",
        swapWithSiteId: "d",
        swapWithSiteName: "D",
        direction: "down",
        confidence: "strong",
        reasons: ["test"],
      },
      d: {
        siteId: "d",
        swapWithSiteId: "b",
        swapWithSiteName: "B",
        direction: "up",
        confidence: "strong",
        reasons: ["test"],
      },
    };

    expect(applySpanshInversionReorder(["a", "b", "c", "d", "e"], hints))
      .toEqual(["c", "d", "a", "b", "e"]);
  });

  it("ignores stale hints for ids missing from the current order", () => {
    const hints: SpanshInversionHints = {
      a: {
        siteId: "a",
        swapWithSiteId: "missing",
        swapWithSiteName: "Missing",
        direction: "down",
        confidence: "strong",
        reasons: ["test"],
      },
    };

    expect(applySpanshInversionReorder(["a", "b", "c"], hints))
      .toEqual(["a", "b", "c"]);
  });
});
