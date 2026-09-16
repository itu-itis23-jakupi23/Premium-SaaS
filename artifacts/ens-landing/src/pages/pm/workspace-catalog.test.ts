import { describe, expect, it } from "vitest";
import { catalogDisplayName } from "./WorkspaceCatalogPanel";
import { ENS_FURNITURE_ITEMS } from "./workspace-model";

describe("catalogDisplayName", () => {
  it("keeps the English half of a bilingual name", () => {
    expect(catalogDisplayName("AHSAP YUVARLAK MASA - WOODEN ROUND TABLE")).toBe("WOODEN ROUND TABLE");
  });

  it("leaves a hyphen inside a word alone", () => {
    // Splitting on a bare "-" would cut this after the 3, and a product code
    // like 312-S in half. Only " - " separates the two languages.
    expect(catalogDisplayName("100 W 3 RENKLI LAMBA - 100 W 3-COLORED LAMP")).toBe("100 W 3-COLORED LAMP");
    expect(catalogDisplayName("312-S")).toBe("312-S");
  });

  it("passes through a name that is only in one language", () => {
    expect(catalogDisplayName("SCREEN")).toBe("SCREEN");
  });

  it("never returns nothing", () => {
    // A trailing separator would otherwise leave an empty title on the row.
    expect(catalogDisplayName("BANKO - ")).toBe("BANKO -");
    expect(catalogDisplayName("")).toBe("");
  });

  it("shortens every name in the real catalogue without emptying one", () => {
    // The panel is 240px wide and the name column is a single line. Anything
    // over about 24 characters truncates, which is what the bilingual names
    // did to all fifty-two of them.
    for (const item of ENS_FURNITURE_ITEMS) {
      const short = catalogDisplayName(item.name);
      expect(short, item.name).not.toBe("");
      expect(short.length, item.name).toBeLessThanOrEqual(item.name.length);
      expect(short.length, item.name).toBeLessThanOrEqual(24);
    }
  });
});
