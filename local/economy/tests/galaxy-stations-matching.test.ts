import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  buildGalaxyStationLookup,
  inferOperationalMarketIdFromGalaxy,
  normalizeStationName,
  resolveGalaxyStationForSite,
} from "../lib/galaxy-stations-matching";

const GALAXY_PATH = path.join(os.tmpdir(), "ic1805-galaxy-stations.json");
const SYS_PATH = path.join(os.tmpdir(), "ic1805-sys.json");

describe("galaxy-stations-matching", () => {
  it("infers operational marketId by name when RC journal id is construction placeholder", () => {
    if (!fs.existsSync(GALAXY_PATH) || !fs.existsSync(SYS_PATH)) return;

    const galaxy = JSON.parse(fs.readFileSync(GALAXY_PATH, "utf8")) as {
      stations: { name: string; marketId: number; updated: string; economies?: Record<string, number> }[];
    };
    const sys = JSON.parse(fs.readFileSync(SYS_PATH, "utf8")) as {
      sites: { name: string; marketId: number; status: string }[];
    };
    const lookup = buildGalaxyStationLookup(
      galaxy.stations.map(s => ({
        marketId: s.marketId,
        name: s.name,
        updated: s.updated ?? "2020-01-01 00:00:00+00",
        economies: s.economies as never,
      })),
      { playerMadeOnly: true },
    );

    const hatzumi = sys.sites.find(s => s.name === "HATZUMI machine shop")!;
    const inferred = inferOperationalMarketIdFromGalaxy(hatzumi, lookup);
    expect(inferred).toBe(4362421507);

    const resolved = resolveGalaxyStationForSite(hatzumi, lookup);
    expect(resolved.kind).toBe("name");
    expect(resolved.station?.name).toBe("Hatzumi Machine Shop");
    expect(resolved.station?.economies?.hightech).toBe(490);
    expect(resolved.note).toContain("3962015234");

    const garcia = sys.sites.find(s => s.name === "Garcia Consulting")!;
    expect(inferOperationalMarketIdFromGalaxy(garcia, lookup)).toBe(4361155843);

    const weil = sys.sites.find(s => s.name === "Weil Reach")!;
    expect(inferOperationalMarketIdFromGalaxy(weil, lookup)).toBeUndefined();
    expect(resolveGalaxyStationForSite(weil, lookup).kind).toBe("marketId");
    expect(resolveGalaxyStationForSite(weil, lookup).note).toContain("no Spansh economies");

    expect(normalizeStationName("HATZUMI machine shop")).toBe(
      normalizeStationName("Hatzumi Machine Shop"),
    );
  });
});
