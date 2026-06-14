import { sanitizeImportedSystemSites } from "../../../src/views/SystemView2/import-sanitize";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const createSys = (): Sys => ({
  v: 6,
  rev: 1,
  name: "Import Test",
  id64: 1,
  architect: "Tester",
  pos: [0, 0, 0],
  reserveLevel: "pristine",
  bodies: [
    {
      name: "Import Test 1",
      num: 1,
      distLS: 10,
      parents: [0],
      type: "rb" as any,
      subType: "Rocky body",
      features: ["landable"] as any,
      radius: -1,
      temp: -1,
      gravity: -1,
    },
  ],
  sites: [
    {
      id: "primary",
      buildId: "",
      marketId: 100,
      name: "Primary Port",
      bodyNum: 1,
      buildType: "vesta",
      status: "complete",
    },
    {
      id: "known-no-market",
      buildId: "",
      marketId: undefined as any,
      name: "Known No Market",
      bodyNum: 1,
      buildType: "silenus",
      status: "complete",
    },
  ],
  slots: {},
  revs: [],
});

describe("Spansh import sanitizing", () => {
  it("keeps existing sites but drops newly imported rows", () => {
    const current = createSys();
    const imported: Sys = {
      ...createSys(),
      sites: [
        {
          id: "bad-unknown",
          buildId: "bad-unknown",
          marketId: undefined as any,
          name: "Rivera's Pride",
          bodyNum: -1,
          buildType: "no_truss",
          status: "build",
        },
        current.sites[0],
        {
          ...current.sites[1],
          marketId: 200,
        },
        {
          id: "&300",
          buildId: "",
          marketId: 300,
          name: "Historical Construction Depot",
          bodyNum: 1,
          buildType: undefined as any,
          status: "complete",
        },
      ],
      idxCalcLimit: 4,
    };

    const result = sanitizeImportedSystemSites(current, imported);

    expect(result.droppedSites.map(site => site.name)).toEqual([
      "Rivera's Pride",
      "Historical Construction Depot",
    ]);
    expect(result.sys.sites.map(site => site.name)).toEqual([
      "Primary Port",
      "Known No Market",
    ]);
    expect(result.sys.sites[1].marketId).toBe(200);
    expect(result.sys.idxCalcLimit).toBe(2);
  });

  it("does not infer an unknown-body import row as the calculation primary port", () => {
    const current = createSys();
    const corrupted: Sys = {
      ...current,
      sites: [
        {
          id: "bad-unknown",
          buildId: "bad-unknown",
          marketId: undefined as any,
          name: "Rivera's Pride",
          bodyNum: -1,
          buildType: "no_truss",
          status: "build",
        },
        ...current.sites,
      ],
      idxCalcLimit: 3,
    };

    const sysMap = buildSystemModel2(corrupted, false, true);

    expect(sysMap.primaryPortId).toBe("primary");
  });
});
