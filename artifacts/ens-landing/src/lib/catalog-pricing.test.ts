import { describe, expect, it } from "vitest";
import { ENS_FURNITURE_ITEMS } from "./furniture-catalog";
import { CURRENCIES, RATES_AS_OF, convertCurrency, ratesAgeInDays, ratesAreStale } from "./currency";

/**
 * Catalogue prices, and the currency they are quoted in.
 *
 * The rental furniture was shipped entirely unpriced, so a booth take-off
 * could not produce a real total - workspace-quote.ts showed "Quote pending"
 * rather than a misleading partial, which was the right call but not a
 * product. The prices were recovered from the previous build, which stored
 * them as `code -> price`.
 *
 * They are lira. The catalogue already carried lighting at 15 and 18, and a
 * showcase at 3450 beside a spotlight at 15 only makes sense if the two are in
 * different currencies: 3450 lira is about 83 dollars, which sits sensibly
 * next to a 15 dollar spotlight, where 3450 dollars does not. So the catalogue
 * is genuinely mixed, every price states its own currency, and the BOM
 * converts. Reading a lira figure as dollars made quotes roughly forty times
 * too high, which is what these tests exist to prevent.
 */

const priced = ENS_FURNITURE_ITEMS.filter((item) => typeof item.price === "number" && item.price > 0);

describe("catalogue prices", () => {
  it("prices the rental furniture that was recovered", () => {
    // 26 of 52. The rest are AV and electrical items the previous build never
    // priced either; they stay absent rather than zero so the unpriced count
    // and the "Quote pending" wording keep telling the truth.
    expect(priced.length).toBe(26);
  });

  it("states a currency on every price", () => {
    // The whole point. A price without a currency is a number waiting to be
    // misread by a factor of forty.
    const silent = priced.filter((item) => !item.priceCurrency);
    expect(
      silent.map((item) => item.sku || item.id),
      `these carry a price but no currency: ${silent.map((i) => i.sku).join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the recovered figures exactly as the previous build had them", () => {
    // Spot-checked against booth_designer_pro's furniture_catalog.js. If these
    // drift, someone has edited prices by hand and should say so.
    const bySku = new Map(priced.map((item) => [item.sku, item]));
    for (const [sku, expected] of [
      ["103", 1450],
      ["208", 3200],
      ["209", 3250],
      ["458", 3380],
      ["461", 3425],
      ["508", 1760],
      ["149", 380],
      ["307", 420],
    ] as const) {
      expect(bySku.get(sku)?.price, `sku ${sku}`).toBe(expected);
      expect(bySku.get(sku)?.priceCurrency, `sku ${sku}`).toBe("TRY");
    }
  });

  it("leaves the AV and electrical items unpriced rather than free", () => {
    // `price: 0` would read as "costs nothing" and quietly drop them from a
    // quote. Absent means "not priced", which is reported.
    const bySku = new Map(ENS_FURNITURE_ITEMS.map((item) => [item.sku, item]));
    for (const sku of ["401", "406", "411", "412", "417", "422"]) {
      const item = bySku.get(sku);
      expect(item, `sku ${sku} missing from the catalogue`).toBeTruthy();
      expect(item?.price ?? 0, `sku ${sku} should be unpriced`).toBe(0);
    }
  });

  it("has no price that would read sensibly in the wrong currency", () => {
    // A lira price under ~50 would be plausible as dollars too, and so could
    // be mislabelled without anyone noticing. None of the recovered figures
    // are in that band, which is what makes the currency check above decisive.
    const ambiguous = priced.filter((item) => item.priceCurrency === "TRY" && item.price! < 100);
    expect(
      ambiguous.map((i) => `${i.sku}=${i.price}`),
      "a lira price this small is hard to distinguish from a dollar one",
    ).toEqual([]);
  });
});

describe("currency conversion", () => {
  it("converts lira to dollars at the published rate", () => {
    const showcase = convertCurrency(3450, "TRY", "USD");
    expect(showcase).toBeCloseTo(3450 / CURRENCIES.TRY.ratePerUsd, 6);
    // Sanity: a showcase rental should land near a lighting item's order of
    // magnitude, not two hundred times it.
    expect(showcase).toBeGreaterThan(20);
    expect(showcase).toBeLessThan(200);
  });

  it("is a no-op between the same currency", () => {
    expect(convertCurrency(1450, "TRY", "TRY")).toBe(1450);
  });

  it("round-trips without drift that would show in a total", () => {
    const back = convertCurrency(convertCurrency(1450, "TRY", "USD"), "USD", "TRY");
    expect(back).toBeCloseTo(1450, 6);
  });

  it("is zero for an unusable amount rather than NaN in a quote", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(convertCurrency(bad, "TRY", "USD"), String(bad)).toBe(0);
    }
  });
});

describe("rate freshness", () => {
  it("publishes when the hand-maintained rates were set", () => {
    expect(RATES_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports the age of the rates", () => {
    const asOf = new Date(`${RATES_AS_OF}T12:00:00.000Z`);
    const tenDaysOn = new Date(asOf.getTime() + 10 * 86_400_000);
    expect(ratesAgeInDays(tenDaysOn)).toBe(10);
    expect(ratesAreStale(tenDaysOn)).toBe(false);
  });

  it("calls the rates stale once they are old enough to mislead", () => {
    // A lira rate moves enough that a months-old constant misstates every
    // converted figure. Better to say so than to present it as current.
    const asOf = new Date(`${RATES_AS_OF}T12:00:00.000Z`);
    const muchLater = new Date(asOf.getTime() + 120 * 86_400_000);
    expect(ratesAreStale(muchLater)).toBe(true);
  });
});
