import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative w-10 h-10 rounded-full bg-background/50 backdrop-blur-md border border-border/50 hover:bg-muted/50 transition-colors"
      data-testid="button-theme-toggle"
    >
      <Sun className="h-5 w-5 absolute transition-all dark:opacity-0 dark:scale-50 opacity-100 scale-100 text-foreground" />
      <Moon className="h-5 w-5 absolute transition-all dark:opacity-100 dark:scale-100 opacity-0 scale-50 text-foreground" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}