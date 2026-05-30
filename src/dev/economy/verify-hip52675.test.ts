import { buildSystemModel2 } from "../../system-model2";
import { Sys } from "../../types2";
import { EconomyMap } from "../../site-data";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_PATH = path.join(os.tmpdir(), "hip52675-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "hip52675-spansh.json");

const roundPct = (v: number) => Math.round(v * 100);

describe("HIP 52675 Escobar Gateway", () => {
  it("compares model vs Spansh", () => {
    if (!fs.existsSync(SYSTEM_PATH)) {
      expect(true).toBe(true);
      return;
    }

    const sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as { id: number; economies: Partial<Record<keyof EconomyMap, number>> }[];
    const spMap = Object.fromEntries(spansh.map(e => [e.id, e]));
    const sysMap = buildSystemModel2(sys, false, true, { enableTerraformableAgricultureBonus: true });
    const site = sysMap.siteMaps.find(s => s.name === "Escobar Gateway");
    const real = spMap[site!.marketId!];

    // eslint-disable-next-line no-console
    console.log({
      buildType: site?.buildType,
      body: site?.body?.type,
      features: site?.body?.features,
      fixed: site?.type.fixed,
      inf: site?.type.inf,
      orbital: site?.type.orbital,
      tier: site?.type.tier,
      intrinsic: site?.intrinsic,
      strong: site?.links?.strongSites.map(s => `${s.name} (${s.type.inf} T${s.type.tier})`),
    });

    for (const key of Object.keys(site!.economies ?? {}).sort()) {
      const inf = key as keyof EconomyMap;
      const model = roundPct(site!.economies![inf] ?? 0);
      const sp = real?.economies?.[inf];
      if ((model > 0 || (sp ?? 0) > 0) && inf === "agriculture") {
        // eslint-disable-next-line no-console
        console.log(`${inf}: model ${model}% spansh ${sp}% diff ${model - (sp ?? 0)}`);
      }
    }

    // eslint-disable-next-line no-console
    console.log("\nAgriculture audit:");
    site!.economyAudit
      ?.filter(e => e.inf === "agriculture")
      .forEach(e => console.log(`  ${e.delta >= 0 ? "+" : ""}${e.delta.toFixed(2)} -> ${e.after.toFixed(2)}: ${e.reason}`));

    expect(roundPct(site!.economies!.agriculture ?? 0)).toBe(real.economies.agriculture);
  });
});
