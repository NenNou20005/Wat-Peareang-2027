import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "default" : "icon"}
      onClick={toggleTheme}
      className={
        showLabel
          ? `w-full justify-between rounded-2xl px-4 py-3 font-normal cursor-pointer ${className ?? ""}`
          : `rounded-full border-border/80 bg-card hover:bg-secondary text-foreground cursor-pointer ${className ?? ""}`
      }
      aria-label={isDark ? "ប្តូរទៅ Light Mode" : "ប្តូរទៅ Dark Mode"}
      title={isDark ? "ប្តូរទៅ Light Mode (☀️)" : "ប្តូរទៅ Dark Mode (🌙)"}
    >
      {showLabel ? (
        <>
          <span className="flex items-center gap-2 text-sm">
            {isDark ? <Sun className="h-4 w-4 text-gold" /> : <Moon className="h-4 w-4 text-foreground" />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {isDark ? "☀️" : "🌙"}
          </span>
        </>
      ) : isDark ? (
        <Sun className="h-4 w-4 text-gold transition-transform hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-foreground transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
}

