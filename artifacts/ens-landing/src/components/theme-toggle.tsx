import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = resolvedTheme === "dark" || resolvedTheme === "light"
    ? resolvedTheme
    : theme === "dark"
      ? "dark"
      : "light"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(activeTheme === "dark" ? "light" : "dark")}
      className="relative w-10 h-10 rounded-full bg-background/50 backdrop-blur-md border border-border/50 hover:bg-muted/50 transition-colors"
      data-testid="button-theme-toggle"
      disabled={!mounted}
      aria-label={activeTheme === "dark" ? t("layout.switchToLight") : t("layout.switchToDark")}
    >
      <Sun aria-hidden="true" className="h-5 w-5 absolute transition-all dark:opacity-0 dark:scale-50 opacity-100 scale-100 text-foreground" />
      <Moon aria-hidden="true" className="h-5 w-5 absolute transition-all dark:opacity-100 dark:scale-100 opacity-0 scale-50 text-foreground" />
    </Button>
  )
}
