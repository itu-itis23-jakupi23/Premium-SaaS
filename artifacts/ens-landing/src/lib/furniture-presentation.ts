import type { FurnitureCatalogItem, FurnitureCategory } from "./furniture-catalog";

export const FURNITURE_CATEGORY_ORDER: FurnitureCategory[] = [
  "all", "tables", "chairs", "seating", "stools", "counters", "displays",
  "storage", "shelves", "appliances", "lighting", "decor", "parts",
];

export function furnitureCategoryFor(item: Pick<FurnitureCatalogItem, "name" | "sku" | "shape">): FurnitureCategory {
  const text = `${item.name} ${item.sku}`.toLowerCase();
  if (item.shape === "bar_stool" || text.includes("tabure") || text.includes("bar stool") || text.includes("bar chair")) return "stools";
  if (item.shape === "chair" || text.includes("sandalye") || text.includes("chair")) {
    if (text.includes("koltuk") || text.includes("armchair") || text.includes("sofa")) return "seating";
    return "chairs";
  }
  if (text.includes("koltuk") || text.includes("sofa") || text.includes("puf") || text.includes("pouffe")) return "seating";
  if (item.shape === "round_table" || item.shape === "rect_table" || text.includes("masa") || text.includes("table")) return "tables";
  if (item.shape === "counter" || text.includes("banko") || text.includes("counter")) return "counters";
  if (item.shape === "cube" || text.includes("vitrin") || text.includes("showcase") || text.includes("teshir") || text.includes("display")) return "displays";
  if (item.shape === "shelf" || item.shape === "wall_shelf" || text.includes("raf") || text.includes("shelf") || text.includes("brosurluk") || text.includes("brochure")) return "shelves";
  if (text.includes("buzdolabi") || text.includes("refrigerator") || text.includes("sebil") || text.includes("water fountain") || text.includes("evye") || text.includes("sink")) return "appliances";
  if (item.shape === "cabinet" || text.includes("dolap") || text.includes("cabinet") || text.includes("rack")) return "storage";
  if (item.shape === "rail_light" || item.shape === "light" || text.includes("lamba") || text.includes("lamp") || text.includes("spotlight")) return "lighting";
  if (text.includes("bitki") || text.includes("plant") || text.includes("ciceklik") || text.includes("floral")) return "decor";
  return "parts";
}

/** Keep the English half of bilingual catalog names; bare SKU hyphens stay intact. */
export function catalogDisplayName(name: string) {
  const halves = String(name || "").split(" - ");
  const english = halves.length > 1 ? halves[halves.length - 1].trim() : "";
  return english || String(name || "").trim();
}

export function furniturePreviewUrl(item: Pick<FurnitureCatalogItem, "previewUrl" | "modelUrl">) {
  if (item.previewUrl) return item.previewUrl;
  if (!item.modelUrl) return "";
  try {
    const filename = decodeURIComponent(item.modelUrl.split("/").pop() || "").replace(/\.glb$/i, " - preview.png");
    return `/ens-workspace-assets/sedef_remaining_furniture_refined_v2/previews-clean/${encodeURIComponent(filename)}`;
  } catch {
    return "";
  }
}
