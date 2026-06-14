import { buildSystemModel2 } from "../../../src/economy/system-model2";
import type { Sys } from "../../../src/types2";

const makeSys = (sites: Sys["sites"]): Sys => ({
  v: 2,
  id64: 1,
  name: "Primary Buff Test",
  bodies: [],
  sites,
  slots: {},
  rev: 1,
  revs: [],
} as Sys);

const baseSite = (id: string, name: string, buildType: string): Sys["sites"][number] => ({
  id,
  name,
  status: "complete",
  bodyNum: -1,
  buildType,
});

describe("system development buff/nerf primary port", () => {
  it("uses sites[0] as the initial buffed port after saved reorder", () => {
    const escobarFirst = buildSystemModel2(makeSys([
      baseSite("S1", "Escobar Gateway", "coriolis"),
      baseSite("S2", "New Primary", "orbis"),
    ]), false, true);

    const newPrimaryFirst = buildSystemModel2(makeSys([
      baseSite("S2", "New Primary", "orbis"),
      baseSite("S1", "Escobar Gateway", "coriolis"),
    ]), false, true);

    expect(escobarFirst.primaryPortId).toBe("S1");
    expect(newPrimaryFirst.primaryPortId).toBe("S2");
    expect(newPrimaryFirst.sumEffects).not.toEqual(escobarFirst.sumEffects);
  });
});
