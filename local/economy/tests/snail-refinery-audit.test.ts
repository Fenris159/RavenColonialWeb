import * as fs from "fs";
import * as path from "path";
import { calculateColonyEconomies2 } from "../../../src/economy";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const FIXTURE = path.join(
  __dirname,
  "..",
  "fixtures",
  "systems",
  "col285-bwu-c3-1",
  "rc-sys.json",
);

describe("Snail refinery reserve boost", () => {
  it("applies pristine reserve boost per refinery strong-link contribution (Spansh 340%)", () => {
    if (!fs.existsSync(FIXTURE)) return;

    const sys = JSON.parse(fs.readFileSync(FIXTURE, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const snail = sysMap.siteMaps.find((s) => s.name === "Snail's Safe Harbor")!;

    calculateColonyEconomies2(snail, sysMap.calcIds);

    const refineryAudit = (snail.economyAudit ?? []).filter((e) => e.inf === "refinery");

    expect(Math.round((snail.economies?.refinery ?? 0) * 100)).toBe(340);
    expect(refineryAudit).toContainEqual(
      expect.objectContaining({ delta: 0.4, reason: "Buff: reserveLevel MAJOR or PRISTINE" }),
    );
    expect(
      refineryAudit.filter((e) => e.reason.includes("boost: System reserveLevel is MAJOR or PRISTINE")),
    ).toHaveLength(2);
  });
});
