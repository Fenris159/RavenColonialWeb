import { getSiteType } from "../../../src/site-data";
import { isTypeAllowedForBody } from "../../../src/components/BuildType/body-build-type-filter";
import { BT } from "../../../src/types2";

describe("asteroid cluster build type filtering", () => {
  it("allows only Asteroid Starport for asteroid cluster bodies", () => {
    expect(isTypeAllowedForBody(BT.ac, getSiteType("asteroid"))).toBe(true);
    expect(isTypeAllowedForBody(BT.ac, getSiteType("coriolis"))).toBe(false);
    expect(isTypeAllowedForBody(BT.ac, getSiteType("dodec"))).toBe(false);
    expect(isTypeAllowedForBody(BT.ac, getSiteType("plutus"))).toBe(false);
  });

  it("does not restrict normal bodies", () => {
    expect(isTypeAllowedForBody(BT.rb, getSiteType("coriolis"))).toBe(true);
    expect(isTypeAllowedForBody(BT.rb, getSiteType("plutus"))).toBe(true);
  });
});
