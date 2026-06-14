import { GetRealEconomies } from "../../../src/api/v2-system";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { EconomyMap } from "../../../src/site-data";
import { Sys } from "../../../src/types2";

const API_BASE = "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net";
const SYSTEM = "HIP 52675";
const ECON_KEYS = [
  "agriculture",
  "extraction",
  "hightech",
  "industrial",
  "military",
  "refinery",
  "terraforming",
  "tourism",
] as const;

const roundPct = (v: number | undefined) => Math.round((v ?? 0) * 100);
const spanshPct = (v: number | undefined) => Math.round(v ?? 0);
const idOf = (id: number | string | undefined) => {
  const n = typeof id === "number" ? id : parseInt(String(id ?? "").replace(/^\D/, ""), 10);
  return Number.isFinite(n) ? n : undefined;
};

describe("HIP 52675 agriculture diagnostic", () => {
  it("prints current saved agriculture and Shoujing compare context", async () => {
    const sys = await fetch(`${API_BASE}/api/v2/system/${encodeURIComponent(SYSTEM)}`)
      .then(r => r.json()) as Sys;
    const real = await fetch(`${API_BASE}/api/v2/system/${encodeURIComponent(SYSTEM)}/spanshEconomies`)
      .then(r => r.json()) as GetRealEconomies[];
    const spanshById = new Map(real.map(r => [idOf(r.id), r.economies]));

    for (const terraformableBonus of [false, true]) {
      const sysMap = buildSystemModel2(JSON.parse(JSON.stringify(sys)), false, true, {
        enableTerraformableAgricultureBonus: terraformableBonus,
      });
      const rows = sysMap.siteMaps
        .filter(site => site.status === "complete" && idOf(site.marketId) !== undefined)
        .map(site => {
          const spansh = spanshById.get(idOf(site.marketId)!);
          if (!spansh || !site.economies) {
            return undefined;
          }
          const mismatches = ECON_KEYS
            .map(key => ({
              key,
              model: roundPct(site.economies?.[key as keyof EconomyMap]),
              spansh: spanshPct(spansh[key as keyof EconomyMap]),
            }))
            .filter(m => m.model !== m.spansh && (m.model > 0 || m.spansh > 0));
          return {
            site,
            body: site.body,
            mismatches,
          };
        })
        .filter(Boolean) as Array<{
          site: typeof sysMap.siteMaps[number];
          body: typeof sysMap.siteMaps[number]["body"];
          mismatches: Array<{ key: string; model: number; spansh: number }>;
        }>;

      const agRows = rows.filter(r => r.mismatches.some(m => m.key === "agriculture"));
      const shoujing = rows.find(r => r.site.name === "Shoujing Terminal");
      // eslint-disable-next-line no-console
      console.log(`\nHIP 52675 rev ${sys.rev}, terraformableBonus=${terraformableBonus}`);
      // eslint-disable-next-line no-console
      console.log("agriculture mismatch rows:", agRows.length);
      for (const row of agRows) {
        const ag = row.mismatches.find(m => m.key === "agriculture")!;
        const other = row.mismatches.filter(m => m.key !== "agriculture")
          .map(m => `${m.key} ${m.model}->${m.spansh}`)
          .join("; ");
        // eslint-disable-next-line no-console
        console.log(
          `${row.site.name} [${row.site.buildType}/${row.site.type.buildClass}] ` +
          `${row.body?.name} ${row.body?.type} features=${(row.body?.features ?? []).join(",") || "-"} ` +
          `ag ${ag.model}->${ag.spansh}${other ? ` | ${other}` : ""}`,
        );
        // eslint-disable-next-line no-console
        console.log(
          "  ag audit:",
          (row.site.economyAudit ?? [])
            .filter(a => a.inf === "agriculture")
            .map(a => `${a.delta}: ${a.reason}`)
            .join(" ; ") || "(none)",
        );
      }
      if (shoujing) {
        // eslint-disable-next-line no-console
        console.log(
          "Shoujing mismatches:",
          shoujing.mismatches.map(m => `${m.key} ${m.model}->${m.spansh}`).join("; ") || "(none)",
        );
        // eslint-disable-next-line no-console
        console.log(
          "Shoujing audit:",
          (shoujing.site.economyAudit ?? [])
            .map(a => `${a.inf} ${a.delta}: ${a.reason}`)
            .join(" ; ") || "(none)",
        );
      }
    }

    expect(sys.name).toBe(SYSTEM);
  }, 30000);
});
