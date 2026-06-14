import {
  buildEdsmMarketIdByNormalizedName,
  getSpanshCompareFailureReason,
  normalizeStationName,
  resolveSpanshEconomyForSite,
  spanshEconomiesNeedRefresh,
} from "../../../src/economy/compare/spansh-economy-resolve";
import type { GetRealEconomies } from "../../../src/api/v2-system";

/** Live Col 285 BW-U c3-1 fixtures (2026-06). */
const SPANSH_ROW: GetRealEconomies = {
  id: 4364923907,
  updated: "2026-06-04 14:00:21+00",
  economies: { agriculture: 5, hightech: 10, military: 195, refinery: 5 },
};

describe("spansh-economy-resolve (Col 285 Fort Snailing)", () => {
  it("resolves via EDSM when journal marketId is missing (numeric EDSM marketId)", () => {
    const edsmByName = buildEdsmMarketIdByNormalizedName([
      { marketId: 4364923907 as unknown as string, name: "Fort Snailing" } as never,
    ]);

    const resolved = resolveSpanshEconomyForSite(
      { name: "Fort Snailing", status: "complete" },
      [SPANSH_ROW],
      edsmByName,
    );

    expect(resolved?.kind).toBe("edsmName");
    expect(resolved?.note).toBe("EDSM name match (no RC marketId -> Spansh 4364923907)");
    expect(resolved?.spanshMarketId).toBe(4364923907);
    expect(resolved?.row.economies?.military).toBe(195);
  });

  it("resolves via EDSM when marketId is string (EDSM API shape)", () => {
    const edsmByName = buildEdsmMarketIdByNormalizedName([
      { marketId: "4364923907", name: "Fort Snailing" } as never,
    ]);

    const resolved = resolveSpanshEconomyForSite(
      { name: "Fort Snailing", status: "complete" },
      [SPANSH_ROW],
      edsmByName,
    );

    expect(resolved?.kind).toBe("edsmName");
    expect(normalizeStationName("Fort Snailing")).toBe("fort snailing");
  });

  it("fails when EDSM index is missing (UI: none matched)", () => {
    const resolved = resolveSpanshEconomyForSite(
      { name: "Fort Snailing", status: "complete" },
      [SPANSH_ROW],
      undefined,
    );
    expect(resolved).toBeNull();
  });

  it("requests Spansh refresh when EDSM id is missing from economies list", () => {
    const edsmByName = buildEdsmMarketIdByNormalizedName([
      { marketId: "4364923907", name: "Fort Snailing" } as never,
    ]);
    expect(
      spanshEconomiesNeedRefresh(
        [{ name: "Fort Snailing", status: "complete" }],
        [],
        edsmByName,
      ),
    ).toBe(true);
  });

  it("reports stale Spansh list when EDSM has marketId but economies cache omits it", () => {
    const edsmByName = buildEdsmMarketIdByNormalizedName([
      { marketId: "4364923907", name: "Fort Snailing" } as never,
    ]);
    const reason = getSpanshCompareFailureReason(
      { name: "Fort Snailing", status: "complete" },
      [],
      edsmByName,
    );
    expect(reason).toContain("4364923907");
    expect(reason).toContain("refresh");
  });
});
