import { buildSystemModel2, EconomyMap } from "../../system-model2";
import { Sys } from "../../types2";
import {
  AgHypothesisScenario,
  compareAgHypothesisScenarios,
  pickBestAgHypothesis,
} from "./ag-hypothesis-models";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SYSTEM_ID = "18494801076";
const API = "https://ravencolonial100-awcbdvabgze4c5cq.canadacentral-01.azurewebsites.net/api/v2";
const SYSTEM_PATH = path.join(os.tmpdir(), "hr4464-sys.json");
const SPANSH_PATH = path.join(os.tmpdir(), "hr4464-spansh.json");

interface SpanshEconomy {
  id: number;
  economies: Partial<Record<keyof EconomyMap, number>>;
}

const ALL_SCENARIOS: AgHypothesisScenario[] = [
  "baseline",
  "exclusive-nearest",
  "exclusive-facility",
  "exclusive-same-body",
  "exclusive-orbit-match",
  "port-budget-v1",
  "port-budget-v2",
  "exclusive-facility-budget-v2",
];

const EXCLUSIVE_SCENARIOS = ALL_SCENARIOS.filter(s => s.startsWith("exclusive"));
const BUDGET_SCENARIOS = ALL_SCENARIOS.filter(s => s.startsWith("port-budget"));

describe("HR 4464 agriculture hypothesis comparison", () => {
  let sys: Sys;
  let spanshMap: Record<number, SpanshEconomy>;

  beforeAll(async () => {
    if (!fs.existsSync(SYSTEM_PATH)) {
      const resp = await fetch(`${API}/system/${SYSTEM_ID}`);
      fs.writeFileSync(SYSTEM_PATH, await resp.text());
    }
    if (!fs.existsSync(SPANSH_PATH)) {
      const resp = await fetch(`${API}/system/${SYSTEM_ID}/spanshEconomies`);
      fs.writeFileSync(SPANSH_PATH, await resp.text());
    }
    sys = JSON.parse(fs.readFileSync(SYSTEM_PATH, "utf8")) as Sys;
    const spansh = JSON.parse(fs.readFileSync(SPANSH_PATH, "utf8")) as SpanshEconomy[];
    spanshMap = Object.fromEntries(spansh.map(entry => [entry.id, entry]));
  }, 60000);

  it("scores exclusive linking vs port-type budgets against Spansh agriculture", () => {
    const sysMap = buildSystemModel2(sys, false, true, {
      enableTerraformableAgricultureBonus: false,
    });

    const scores = compareAgHypothesisScenarios(sysMap, spanshMap, ALL_SCENARIOS);

    // eslint-disable-next-line no-console
    console.log("\n=== HR 4464 agriculture hypothesis scores (higher matches, lower MAE wins) ===");
    for (const s of scores) {
      // eslint-disable-next-line no-console
      console.log(
        `${s.scenario.padEnd(32)} matches=${s.matches}/${s.compared}  MAE=${s.mae.toFixed(2)}%`,
      );
    }

    // eslint-disable-next-line no-console
    console.log("\n=== Body 99 pair (Recycles vs Roughly) ===");
    for (const s of scores) {
      const r = s.results.find(x => x.name.includes("Recycles Rusty Rubbish"))!;
      const o = s.results.find(x => x.name.includes("Roughly Reinforced"))!;
      // eslint-disable-next-line no-console
      console.log(
        `${s.scenario.padEnd(32)} Recycles spansh=${r.spanshAg} sim=${r.simulatedAg} assigned=${r.assignedPool ?? r.agPool} | Roughly spansh=${o.spanshAg} sim=${o.simulatedAg} assigned=${o.assignedPool ?? o.agPool}`,
      );
    }

    const baseline = scores.find(s => s.scenario === "baseline")!;
    const bestExclusive = pickBestAgHypothesis(scores.filter(s => EXCLUSIVE_SCENARIOS.includes(s.scenario)));
    const bestBudget = pickBestAgHypothesis(scores.filter(s => BUDGET_SCENARIOS.includes(s.scenario)));

    // eslint-disable-next-line no-console
    console.log("\n=== Determination ===");
    // eslint-disable-next-line no-console
    console.log(`Baseline RC: ${baseline.matches}/${baseline.compared} MAE=${baseline.mae.toFixed(2)}`);
    // eslint-disable-next-line no-console
    console.log(
      `Best exclusive-only: ${bestExclusive.scenario} ${bestExclusive.matches}/${bestExclusive.compared} MAE=${bestExclusive.mae.toFixed(2)}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `Best budget-only: ${bestBudget.scenario} ${bestBudget.matches}/${bestBudget.compared} MAE=${bestBudget.mae.toFixed(2)}`,
    );

    const recyclesBudget = scores.find(s => s.scenario === "port-budget-v2")!.results.find(r =>
      r.name.includes("Recycles Rusty Rubbish"),
    )!;
    const roughlyBudget = scores.find(s => s.scenario === "port-budget-v2")!.results.find(r =>
      r.name.includes("Roughly Reinforced"),
    )!;

    expect(recyclesBudget.spanshAg).toBe(115);
    expect(roughlyBudget.spanshAg).toBe(160);
    expect(recyclesBudget.simulatedAg).toBe(115);

    // Production uses port-budget-v2 rules; simplified hypothesis sim may trail slightly.
    expect(baseline.mae).toBeLessThan(bestExclusive.mae);
    expect(bestBudget.mae).toBeLessThan(bestExclusive.mae);

    const recyclesBaseline = baseline.results.find(r => r.name.includes("Recycles Rusty Rubbish"))!;
    expect(recyclesBaseline.simulatedAg).toBe(115);
    expect(recyclesBaseline.spanshAg).toBe(115);
  });
});
