import { describe, expect, it } from "vitest";
import { quotePresentation } from "./workspace-quote";
import { quoteTotals } from "@/pages/pm/workspace-bom";
import { ENS_FURNITURE_ITEMS } from "@/pages/pm/workspace-model";
import type { WorkspacePlacedItem } from "@/pages/pm/workspace-model";

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

describe("quotePresentation", () => {
  it("prints a complete total on its own", () => {
    const quote = quotePresentation({ costEstimateCents: 250_000, unpricedItemCount: 0, formatMoney: money });
    expect(quote.value).toBe("$2,500");
    expect(quote.note).toBeNull();
    expect(quote.partial).toBe(false);
  });

  it("never presents a partial total as the price", () => {
    // This is the whole point of the module: the figure is real, but it is not
    // the price, and whoever reads it has to be told which.
    const quote = quotePresentation({ costEstimateCents: 250_000, unpricedItemCount: 7, formatMoney: money });
    expect(quote.value).toBe("$2,500");
    expect(quote.note).toBe("excludes 7 unpriced items");
    expect(quote.partial).toBe(true);
  });

  it("says why a quote is pending when nothing is priced", () => {
    const quote = quotePresentation({ costEstimateCents: 0, unpricedItemCount: 3, formatMoney: money });
    expect(quote.value).toBe("Quote pending");
    expect(quote.note).toBe("3 items still to be priced");
    expect(quote.partial).toBe(true);
  });

  it("reads correctly for a single item", () => {
    expect(quotePresentation({ costEstimateCents: 100, unpricedItemCount: 1, formatMoney: money }).note)
      .toBe("excludes 1 unpriced item");
  });

  it("treats a missing count as nothing to qualify", () => {
    const quote = quotePresentation({ costEstimateCents: 100, formatMoney: money });
    expect(quote.partial).toBe(false);
    expect(quote.note).toBeNull();
  });
});

describe("the estimate a client is actually shown today", () => {
  function placed(catalogId: string, id: string): WorkspacePlacedItem {
    return {
      id, catalogId, name: catalogId, sku: catalogId, qty: 1, w: 1, d: 1, h: 1,
      color: "#000", weight: 10, x: 1, z: 1, rotation: 0, kind: "furniture",
    };
  }

  /**
   * This test used to assert the opposite - that the whole catalogue was
   * unpriced - and said so, noting it should be the first to fail when real
   * prices landed and that its fix was to assert the reverse. The rental
   * prices have now been recovered from the previous build, so this is that
   * fix.
   *
   * The module still earns its place: 26 of the 52 items are priced, and the
   * AV and electrical items the previous build never priced are still absent,
   * so a take-off produces a real figure *and* has to keep qualifying it.
   */
  it("prices the furniture it has and still counts what it does not", () => {
    const pricedItems = ENS_FURNITURE_ITEMS.filter(item => item.price);
    const unpricedItems = ENS_FURNITURE_ITEMS.filter(item => !item.price);
    expect(pricedItems.length).toBeGreaterThan(0);
    expect(unpricedItems.length).toBeGreaterThan(0);

    const placedPriced = pricedItems.slice(0, 3).map((item, i) => placed(item.id, `p${i}`));
    const totals = quoteTotals({
      structItems: [], roomItems: [], placedItems: placedPriced, fasciaSubtotal: 0,
    });
    // A real subtotal, converted out of lira - not the zero it used to be.
    expect(totals.placedSubtotal).toBeGreaterThan(0);
    expect(totals.unpricedItems).toBe(0);
    expect(quotePresentation({
      costEstimateCents: totals.quoteTotalCents,
      unpricedItemCount: totals.unpricedItems,
      formatMoney: money,
    }).partial).toBe(false);
  });

  it("still qualifies a total that includes an unpriced item", () => {
    // The AV and electrical items remain unpriced, so a stand with a TV on it
    // must not present its total as complete.
    const pricedItem = ENS_FURNITURE_ITEMS.find(item => item.price)!;
    const unpricedItem = ENS_FURNITURE_ITEMS.find(item => !item.price)!;
    const totals = quoteTotals({
      structItems: [],
      roomItems: [],
      placedItems: [placed(pricedItem.id, "p0"), placed(unpricedItem.id, "p1")],
      fasciaSubtotal: 0,
    });
    expect(totals.unpricedItems).toBe(1);
    expect(quotePresentation({
      costEstimateCents: totals.quoteTotalCents,
      unpricedItemCount: totals.unpricedItems,
      formatMoney: money,
    }).partial).toBe(true);
  });

  it("stops qualifying the total once an item carries a price", () => {
    const items = [placed("priced", "p0")];
    const totals = quoteTotals({
      structItems: [], roomItems: [], placedItems: items, fasciaSubtotal: 0,
      priceFor: id => (id === "priced" ? 400 : undefined),
    });
    expect(totals.unpricedItems).toBe(0);
    expect(quotePresentation({
      costEstimateCents: totals.quoteTotalCents,
      unpricedItemCount: totals.unpricedItems,
      formatMoney: money,
    }).partial).toBe(false);
  });
});
