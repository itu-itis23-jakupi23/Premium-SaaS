import { useState, type DragEventHandler } from "react";
import { useTranslation } from "react-i18next";
import { Box, CirclePlus, Minus } from "lucide-react";
import type { FurnitureCatalogItem, FurnitureCategory } from "@/lib/furniture-catalog";
import { catalogDisplayName, furniturePreviewUrl, FURNITURE_CATEGORY_ORDER } from "@/lib/furniture-presentation";
import { convertCurrency, useCurrency } from "@/lib/currency";
import "./furniture-gallery.css";

export function FurnitureCategoryTabs({ active, counts, onChange }: {
  active: FurnitureCategory;
  counts: Map<FurnitureCategory, number>;
  onChange: (category: FurnitureCategory) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="furniture-gallery__filters" role="group" aria-label={t("client.workspace.element.furniture")}>
      {FURNITURE_CATEGORY_ORDER.filter(category => (counts.get(category) || 0) > 0).map(category => (
        <button
          key={category}
          type="button"
          className="furniture-gallery__filter"
          aria-pressed={active === category}
          onClick={() => onChange(category)}
        >
          {t(`furnitureGallery.categories.${category}`)}
          {category === "all" && <span>{counts.get(category)}</span>}
        </button>
      ))}
    </div>
  );
}

export function FurnitureCatalogCard({ item, count, active = false, dragging = false, disabled = false, availability,
  onAdd, onRemove, onBeginDrag, onEndDrag,
}: {
  item: FurnitureCatalogItem;
  count: number;
  active?: boolean;
  dragging?: boolean;
  disabled?: boolean;
  availability?: string;
  onAdd: () => void;
  onRemove?: () => void;
  onBeginDrag: DragEventHandler<HTMLDivElement>;
  onEndDrag: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();
  const previewUrl = furniturePreviewUrl(item);
  const [failedPreview, setFailedPreview] = useState("");
  const name = catalogDisplayName(item.name);
  /**
   * Priced in the currency the toolbar is set to, not the one the catalogue
   * happens to store.
   *
   * The catalogue is deliberately mixed - a showcase is recorded in lira, a
   * spotlight in dollars - and this card rendered each item in its own
   * currency while the toolbar, the stand total and the BOM were all showing
   * the selected one. With EUR selected, a table stored at TRY 1,450 read as
   * though it cost 1,450 of the currency everything else on screen was in.
   * It is about forty euros. Quoting from that misreads by a factor of
   * thirty-six, and the number looks entirely reasonable while it does.
   */
  const price = item.price != null && Number.isFinite(item.price) && item.price > 0
    ? new Intl.NumberFormat(i18n.resolvedLanguage || "en", {
      style: "currency", currency, currencyDisplay: "code", maximumFractionDigits: 0,
    }).format(convertCurrency(item.price, item.priceCurrency ?? "USD", currency))
    : t("furnitureGallery.quotePending");

  return (
    <div
      className={`furniture-card${active ? " furniture-card--active" : ""}${dragging ? " furniture-card--dragging" : ""}${count > 0 ? " furniture-card--placed" : ""}`}
      data-catalog-item-id={item.id}
      data-catalog-draggable={disabled ? "false" : "true"}
      draggable={!disabled}
      onDragStart={onBeginDrag}
      onDragEnd={onEndDrag}
    >
      <button type="button" className="furniture-card__add" disabled={disabled} onClick={onAdd}
        aria-label={t("client.workspace.propose.addItem", { name })} title={`${item.name}\n${item.dim} m`}>
        <span className="furniture-card__image">
          {previewUrl && failedPreview !== previewUrl
            ? <img src={previewUrl} alt="" draggable={false} loading="lazy" onError={() => setFailedPreview(previewUrl)} />
            : <Box size={30} aria-hidden="true" className="furniture-card__placeholder" />}
          <span className="furniture-card__sku">{item.sku}</span>
          {count > 0 && <span className="furniture-card__count" aria-label={t("client.workspace.propose.yourFurniture", { count })}>×{count}</span>}
        </span>
        <span className="furniture-card__name">{name}</span>
        <span className="furniture-card__dimensions">{item.dim.replace(/\s*x\s*/g, " × ")} m</span>
        <span className="furniture-card__footer">
          <span className="furniture-card__price">{price}</span>
          <CirclePlus size={19} strokeWidth={1.8} aria-hidden="true" />
        </span>
        {availability && <span className="furniture-card__availability">{availability}</span>}
      </button>
      {count > 0 && onRemove && <button type="button" className="furniture-card__remove" onClick={onRemove}
        aria-label={t("client.workspace.propose.removeItem", { name })}>
        <Minus size={14} aria-hidden="true" />
      </button>}
    </div>
  );
}
