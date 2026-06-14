import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildEdsmMarketIdByNormalizedName,
  isConstructionSpanshPlaceholder,
  normalizeStationName,
  resolveSpanshEconomyForSite,
} from "../../../src/economy/compare/spansh-economy-resolve";
import type { GetRealEconomies } from "../../../src/api/v2-system";

const GALAXY_PATH = path.join(os.tmpdir(), "ic1805-galaxy-stations.json");

describe("spansh-economy-resolve (IC 1805 HATZUMI)", () => {
  it("detects construction placeholder and resolves via EDSM name index", () => {
    if (!fs.existsSync(GALAXY_PATH)) return;

    const galaxy = JSON.parse(fs.readFileSync(GALAXY_PATH, "utf8")) as {
      stations: { name: string; marketId: number; updated: string; economies?: Record<string, number> }[];
    };
    const realEconomies: GetRealEconomies[] = galaxy.stations.map(s => ({
      id: s.marketId,
      updated: s.updated ?? "2020-01-01 00:00:00+00",
      economies: s.economies as GetRealEconomies["economies"],
    }));

    const journalRow = realEconomies.find(r => r.id === 3962015234);
    expect(isConstructionSpanshPlaceholder(journalRow?.economies)).toBe(true);

    const edsmByName = buildEdsmMarketIdByNormalizedName([
      { marketId: "4362421507", name: "Hatzumi Machine Shop" } as never,
    ]);

    const resolved = resolveSpanshEconomyForSite(
      { name: "HATZUMI machine shop", marketId: 3962015234, status: "complete" },
      realEconomies,
      edsmByName,
    );

    expect(resolved?.kind).toBe("edsmName");
    expect(resolved?.note).toBe("EDSM name match (RC marketId 3962015234 -> Spansh 4362421507)");
    expect(resolved?.spanshMarketId).toBe(4362421507);
    expect(resolved?.row.economies?.hightech).toBe(490);
    expect(normalizeStationName("HATZUMI machine shop")).toBe(
      normalizeStationName("Hatzumi Machine Shop"),
    );
  });
});
