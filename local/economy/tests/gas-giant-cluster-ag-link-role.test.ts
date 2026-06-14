/**
 * Sibling-moon demeter/picumnus strong-link body primaries only, not hub subordinates.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import {
  bodyPrimaryReceivesGasGiantClusterAgStrongLinks,
  findGasGiantClusterAgricultureInstallations,
} from "../../../src/economy/economy-link-sources";
import { Sys } from "../../../src/types2";

const SYS_PATH = path.join(os.tmpdir(), "col285-bwu-sys.json");

describe("gas giant cluster agriculture link role", () => {
  it("orbital primary receives cluster farm; hub subordinate does not", () => {
    if (!fs.existsSync(SYS_PATH)) {
      return;
    }
    const sys = JSON.parse(fs.readFileSync(SYS_PATH, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);

    const holdfast = sysMap.siteMaps.find(s => s.name === "Pelagic Holdfast Hyggekrog")!;
    const snail = sysMap.siteMaps.find(s => s.name === "Snail's Safe Harbor")!;
    const kelp = sysMap.siteMaps.find(s => s.name === "Snail's Kelp Farm")!;
    const body = holdfast.body!;

    expect(bodyPrimaryReceivesGasGiantClusterAgStrongLinks(body, snail)).toBe(true);
    expect(bodyPrimaryReceivesGasGiantClusterAgStrongLinks(body, holdfast)).toBe(false);

    expect(snail.links?.strongSites?.some(s => s.id === kelp.id)).toBe(true);
    expect(holdfast.links?.strongSites?.some(s => s.buildType === "demeter")).toBe(false);

    expect(Math.round((holdfast.economies?.agriculture ?? 0) * 100)).toBe(100);
    expect(Math.round((snail.economies?.agriculture ?? 0) * 100)).toBe(165);
  });

  it("surface primary receives cluster farm when no orbital primary exists", () => {
    const sys = {
      bodies: [
        { num: 0, name: "Star", type: "st", parents: [], features: [] },
        { num: 12, name: "GG", type: "gg", parents: [0], features: [] },
        { num: 14, name: "Moon A", type: "rb", parents: [12, 0], features: ["landable"] },
        { num: 15, name: "Moon B", type: "rb", parents: [12, 0], features: ["landable"] },
      ],
      reserveLevel: "pristine",
      sites: [
        {
          id: "surface",
          name: "Surface Primary",
          buildType: "lachesis",
          bodyNum: 14,
          status: "complete",
          orbital: false,
        },
        {
          id: "farm",
          name: "Moon B Farm",
          buildType: "demeter",
          bodyNum: 15,
          status: "complete",
          orbital: false,
        },
      ],
    } as unknown as Sys;

    const sysMap = buildSystemModel2(sys, false, true);
    const surface = sysMap.siteMaps.find(s => s.id === "surface")!;
    const moonA = sys.bodies.find(b => b.num === 14)!;
    const bodyMap = sysMap.bodyMap[moonA.name];

    expect(bodyPrimaryReceivesGasGiantClusterAgStrongLinks(bodyMap, surface)).toBe(true);
    const cluster = findGasGiantClusterAgricultureInstallations(
      bodyMap,
      sysMap.bodyMap,
      sys.bodies,
      sysMap.calcIds,
    );
    expect(cluster.map(s => s.id)).toEqual(["farm"]);
    expect(surface.links?.strongSites?.some(s => s.id === "farm")).toBe(true);
  });
});
