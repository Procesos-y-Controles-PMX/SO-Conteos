"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = !mounted
    ? "Cambiar tema"
    : isDark
      ? "Cambiar a modo claro"
      : "Cambiar a modo oscuro";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "neu-button inline-flex h-9 w-9 items-center justify-center rounded-full text-fg-subtle hover:text-fg",
        className,
      )}
    >
      {isDark ? <Moon className="h-4 w-4" strokeWidth={2} /> : <Sun className="h-4 w-4" strokeWidth={2} />}
    </button>
  );
}
