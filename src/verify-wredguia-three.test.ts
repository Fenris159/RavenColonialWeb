import { buildSystemModel2 } from "./system-model2";
import { Sys } from "./types2";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "wredguia-sys.json");

describe("Wredguia Emit / Spatula / Keller audit", () => {
  it("dumps model vs spansh for three stations", () => {
    const sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const sp = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "wredguia-spansh.json"), "utf8")) as { id: number; economies: { agriculture?: number } }[];
    const spMap = Object.fromEntries(sp.map(e => [e.id, e]));
    const sysMap = buildSystemModel2(sys, false, true, { enableTerraformableAgricultureBonus: true });

    for (const name of ["Emit", "Spatula City", "Keller Junction"]) {
      const site = sysMap.siteMaps.find(s => s.name === name);
      expect(site).toBeDefined();
      const spansh = spMap[site!.marketId!]?.economies?.agriculture;
      const model = Math.round((site!.economies?.agriculture ?? 0) * 100);
      // eslint-disable-next-line no-console
      console.log(`\n${name}: model ${model}% spansh ${spansh}%`);
      expect(model).toBe(spansh);
    }
  });
});
