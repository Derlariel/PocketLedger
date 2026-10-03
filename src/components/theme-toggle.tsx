"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useEffect(() => {
    const saved = localStorage.getItem("pocketledger-theme");
    const next = saved === "dark" || (saved === null && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", next);
  }, []);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pocketledger-theme", next ? "dark" : "light");
  }
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label="สลับโหมดสี"><Sun className="hidden dark:block" aria-hidden="true" /><Moon className="dark:hidden" aria-hidden="true" /></Button>;
}
