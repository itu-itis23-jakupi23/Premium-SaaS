import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"
import { useTheme as useNextTheme } from "next-themes"

export const THEME_STORAGE_KEY = "ens-theme"
export type AppThemeMode = "light" | "dark" | "system"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function useTheme() {
  return useNextTheme()
}

export function normalizeThemeMode(value: unknown): AppThemeMode | null {
  return value === "light" || value === "dark" || value === "system" ? value : null
}

export function readThemePreference(fallback: AppThemeMode = "dark"): AppThemeMode {
  if (typeof window === "undefined") return fallback
  return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY)) ?? fallback
}
