import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Display-level currency conversion.
 *
 * All money in the system is stored in USD (cents server-side). Conversion
 * happens only at render time. Rates below are display defaults; the leasing
 * company can maintain real rates later without changing stored amounts.
 */
export const CURRENCIES = {
  USD: { symbol: "$", label: "USD", ratePerUsd: 1 },
  EUR: { symbol: "€", label: "EUR", ratePerUsd: 0.92 },
  TRY: { symbol: "₺", label: "TRY", ratePerUsd: 41.5 },
  GBP: { symbol: "£", label: "GBP", ratePerUsd: 0.78 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

const STORAGE_KEY = "ens-display-currency";

function readStoredCurrency(): CurrencyCode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw in CURRENCIES) return raw as CurrencyCode;
  } catch {
    /* storage unavailable */
  }
  return "USD";
}

// Module-level mirror so plain (non-hook) helpers like formatMoneyUSD can be
// called from existing code paths; the provider keeps it in sync and any
// consumer of useCurrency() re-renders on change.
let activeCurrency: CurrencyCode = "USD";

export function convertFromUsd(usdAmount: number, currency: CurrencyCode = activeCurrency) {
  return usdAmount * CURRENCIES[currency].ratePerUsd;
}

/** Format an amount given in USD units (dollars) in the active display currency. */
export function formatMoneyUSD(usdAmount: number, currency: CurrencyCode = activeCurrency) {
  const meta = CURRENCIES[currency];
  const converted = convertFromUsd(usdAmount, currency);
  return `${meta.label} ${Math.max(0, Math.round(converted)).toLocaleString()}`;
}

/** Format an amount given in USD cents in the active display currency. */
export function formatMoneyCentsUSD(usdCents: number, currency: CurrencyCode = activeCurrency) {
  return formatMoneyUSD(usdCents / 100, currency);
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  formatMoney: (usdAmount: number) => string;
  formatMoneyCents: (usdCents: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const stored = typeof window !== "undefined" ? readStoredCurrency() : "USD";
    activeCurrency = stored;
    return stored;
  });

  const setCurrency = useCallback((code: CurrencyCode) => {
    activeCurrency = code;
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    activeCurrency = currency;
  }, [currency]);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    setCurrency,
    formatMoney: (usdAmount: number) => formatMoneyUSD(usdAmount, currency),
    formatMoneyCents: (usdCents: number) => formatMoneyCentsUSD(usdCents, currency),
  }), [currency, setCurrency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (ctx) return ctx;
  // Fallback for surfaces rendered outside the provider: static USD.
  return {
    currency: "USD",
    setCurrency: () => undefined,
    formatMoney: (usd: number) => formatMoneyUSD(usd, "USD"),
    formatMoneyCents: (cents: number) => formatMoneyCentsUSD(cents, "USD"),
  };
}

/**
 * Compact currency selector. `variant="header"` matches the dashboard header
 * icon buttons; `variant="toolbar"` is dense for the workspace top bars.
 */
export function CurrencySwitcher({ variant = "header" }: { variant?: "header" | "toolbar" }) {
  const { currency, setCurrency } = useCurrency();
  const base = variant === "header"
    ? "h-9 rounded-md border border-border bg-card/60 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    : "h-7 rounded border border-border/60 bg-transparent px-1.5 text-[10px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-foreground";

  return (
    <select
      aria-label="Display currency"
      value={currency}
      onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
      className={`${base} cursor-pointer appearance-none outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
    >
      {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
        <option key={code} value={code}>
          {CURRENCIES[code].symbol} {code}
        </option>
      ))}
    </select>
  );
}
