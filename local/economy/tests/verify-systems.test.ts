/**
 * Data-driven RC vs Spansh regression for systems listed in fixtures/systems.manifest.json.
 *
 * Refresh fixtures:
 *   node local/economy/scripts/refresh-system-fixtures.js
 *
 * Reports only (no per-system pass/fail thresholds until you add golden expectations).
 */
import * as fs from "fs";
import * as path from "path";
import { Sys } from "../../../src/types2";
import {
  formatCompareSummary,
  runSystemCompare,
  type CompareReport,
} from "../lib/compare-rc-spansh";
import type { GalaxyStationEconomy } from "../lib/galaxy-stations-util";

const FIXTURES_ROOT = path.join(__dirname, "..", "fixtures");
const MANIFEST_PATH = path.join(FIXTURES_ROOT, "systems.manifest.json");
const SYSTEMS_DIR = path.join(FIXTURES_ROOT, "systems");

interface ManifestSystem {
  slug: string;
  name: string;
  id64: number;
  /** Optional: fail test when dockable full-match rate drops below this (0–100). */
  minDockableMatchPct?: number;
}

interface Manifest {
  maxAgeDays?: number;
  preferNameMatch?: boolean;
  systems: ManifestSystem[];
}

interface SpanshFixture {
  stations: GalaxyStationEconomy[];
}

const loadManifest = (): Manifest => {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { systems: [] };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
};

const loadSystemFixtures = (slug: string): { sys: Sys; stations: GalaxyStationEconomy[] } | null => {
  const dir = path.join(SYSTEMS_DIR, slug);
  const sysPath = path.join(dir, "rc-sys.json");
  const spanshPath = path.join(dir, "spansh-stations.json");
  if (!fs.existsSync(sysPath) || !fs.existsSync(spanshPath)) {
    return null;
  }
  const sys = JSON.parse(fs.readFileSync(sysPath, "utf8")) as Sys;
  const spansh = JSON.parse(fs.readFileSync(spanshPath, "utf8")) as SpanshFixture;
  return { sys, stations: spansh.stations || [] };
};

describe("RC vs Spansh (fixture-driven systems)", () => {
  const manifest = loadManifest();
  const maxAgeMs = (manifest.maxAgeDays ?? 90) * 24 * 60 * 60 * 1000;
  const preferNameMatch = manifest.preferNameMatch ?? true;

  if (!manifest.systems.length) {
    it("manifest is empty — add systems and run refresh-system-fixtures.js", () => {
      // eslint-disable-next-line no-console
      console.log(
        "\nNo systems in local/economy/fixtures/systems.manifest.json.\n" +
          "Add entries, then: node local/economy/scripts/refresh-system-fixtures.js\n",
      );
      expect(true).toBe(true);
    });
    return;
  }

  const reports: CompareReport[] = [];

  for (const entry of manifest.systems) {
    const slug = entry.slug;
    describe(entry.name, () => {
      it(`compare (${slug})`, () => {
        const fixtures = loadSystemFixtures(slug);
        if (!fixtures) {
          // eslint-disable-next-line no-console
          console.log(
            `\nMissing fixtures for ${slug}. Run:\n` +
              `  node local/economy/scripts/refresh-system-fixtures.js --slug=${slug}\n`,
          );
          expect(fixtures).not.toBeNull();
          return;
        }

        const report = runSystemCompare(fixtures.sys, fixtures.stations, {
          maxAgeMs,
          preferNameMatch,
        });
        reports.push(report);

        const reportPath = path.join(SYSTEMS_DIR, slug, "compare-report.json");
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // eslint-disable-next-line no-console
        console.log(formatCompareSummary(report));
        // eslint-disable-next-line no-console
        console.log("Report:", reportPath);

        expect(report.matchedFresh).toBeGreaterThan(0);
        expect(report.modelCompared).toBeGreaterThan(0);

        if (typeof entry.minDockableMatchPct === "number" && report.modelComparedDockable > 0) {
          const pct = Math.round((100 * report.modelFullMatchDockable) / report.modelComparedDockable);
          expect(pct).toBeGreaterThanOrEqual(entry.minDockableMatchPct);
        }
      });
    });
  }

  afterAll(() => {
    if (reports.length > 1) {
      // eslint-disable-next-line no-console
      console.log("\n=== All systems summary ===");
      for (const r of reports) {
        const pct = r.modelCompared
          ? Math.round((100 * r.modelFullMatch) / r.modelCompared)
          : 0;
        // eslint-disable-next-line no-console
        console.log(`  ${r.systemName}: ${r.modelFullMatch}/${r.modelCompared} full match (${pct}%)`);
      }
    }
  });
});
