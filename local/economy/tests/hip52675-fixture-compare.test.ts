import * as fs from "fs";
import * as path from "path";
import { runSystemCompare, formatCompareSummary } from "../../local/economy/lib/compare-rc-spansh";
import { Sys } from "../types2";
import type { GalaxyStationEconomy } from "../../local/economy/lib/galaxy-stations-util";

describe("HIP 52675 fixture compare", () => {
  it("writes current RC vs Spansh report", () => {
    const dir = path.join(process.cwd(), "local", "economy", "fixtures", "systems", "hip52675");
    const sys = JSON.parse(fs.readFileSync(path.join(dir, "rc-sys.json"), "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(path.join(dir, "spansh-stations.json"), "utf8")) as {
      stations: GalaxyStationEconomy[];
    };

    const report = runSystemCompare(sys, spansh.stations, {
      maxAgeMs: 90 * 24 * 60 * 60 * 1000,
      preferNameMatch: true,
    });

    fs.writeFileSync(path.join(dir, "compare-report.json"), JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log(formatCompareSummary(report));

    expect(report.matchedFresh).toBeGreaterThan(0);
  });
});
