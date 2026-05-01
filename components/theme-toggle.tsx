"use client";

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as "dark" | "light" | null;
    const designVersion = localStorage.getItem("theme-design-version");
    const initial =
      designVersion === "layers-paper-calm-v1" && stored ? stored : "light";
    if (designVersion !== "layers-paper-calm-v1") {
      localStorage.setItem("theme", initial);
      localStorage.setItem("theme-design-version", "layers-paper-calm-v1");
    }
    setTheme(initial);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(initial);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
  };

  if (!mounted) return <div className="w-[44px] h-[44px]" />;

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
