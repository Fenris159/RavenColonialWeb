import { getSiteType } from "../../../src/site-data";
import { isTypeValid2, SysMap2 } from "../../../src/economy/system-model2";

const makeSysMap = (tier2: number, tier3: number, taxCount = 0) => ({
  tierPoints: { tier2, tier3 },
  taxCount,
  siteMaps: [],
} as unknown as SysMap2);

describe("build type tier point validity", () => {
  it("flags Tier 3 starports when Tier 3 points are insufficient", () => {
    for (const buildType of ["dodec", "ocellus", "apollo"]) {
      const validity = isTypeValid2(makeSysMap(0, -54), getSiteType(buildType), undefined);

      expect(validity.isValid).toBe(false);
      expect(validity.msg).toBe("Not enough Tier 3 points");
    }
  });

  it("uses taxed Tier 3 starport needs instead of raw site-type needs", () => {
    for (const buildType of ["dodec", "ocellus", "apollo"]) {
      const validity = isTypeValid2(makeSysMap(0, 10, 8), getSiteType(buildType), undefined);

      expect(validity.isValid).toBe(false);
      expect(validity.msg).toBe("Not enough Tier 3 points");
    }
  });
});
