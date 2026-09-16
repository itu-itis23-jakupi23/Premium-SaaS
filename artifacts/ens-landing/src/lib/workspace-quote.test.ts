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

  it("counts every catalogue item as unpriced, because the catalogue is priced at zero", () => {
    // Guards the reason this module exists. When real prices land in the
    // catalogue this test is the one that should fail first, and its fix is to
    // assert the opposite.
    expect(ENS_FURNITURE_ITEMS.every(item => !item.price)).toBe(true);

    const items = ENS_FURNITURE_ITEMS.slice(0, 5).map((item, i) => placed(item.id, `p${i}`));
    const totals = quoteTotals({ structItems: [], roomItems: [], placedItems: items, fasciaSubtotal: 0 });
    expect(totals.placedSubtotal).toBe(0);
    expect(totals.unpricedItems).toBe(5);

    const quote = quotePresentation({
      costEstimateCents: totals.quoteTotalCents,
      unpricedItemCount: totals.unpricedItems,
      formatMoney: money,
    });
    expect(quote.partial).toBe(true);
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
