import * as fs from "fs";
import * as path from "path";
import { buildSystemModel2 } from "../../../src/economy/system-model2";
import { Sys } from "../../../src/types2";

const fixturePath = path.join(
  process.cwd(),
  "local",
  "economy",
  "fixtures",
  "systems",
  "synuefai-cxv-c18-6",
  "rc-sys.json",
);

describe("Synuefai Scobee fixed BIO regression", () => {
  it("does not promote a single agriculture weak link into BIO agriculture and terraforming", () => {
    const sys = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as Sys;
    const sysMap = buildSystemModel2(sys, false, true);
    const site = sysMap.siteMaps.find(s => s.name === "Scobee Platform")!;

    expect(Math.round((site.economies?.agriculture ?? 0) * 100)).toBe(5);
    expect(site.economies?.terraforming ?? 0).toBe(0);
    expect(site.economyAudit?.filter(a => a.inf === "agriculture").map(a => a.reason)).not.toContain(
      "Buff: body has BIO",
    );
    expect(site.economyAudit?.filter(a => a.inf === "terraforming").map(a => a.reason)).not.toContain(
      "Buff: body has BIO",
    );
  });
});
