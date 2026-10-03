"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pocketledger-theme", next ? "dark" : "light");
    setDark(next);
  }
  return <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"}>{dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</Button>;
}
