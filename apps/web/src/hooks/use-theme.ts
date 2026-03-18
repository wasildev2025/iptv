"use client";

import { create } from "zustand";

interface ThemeState {
  theme: "light" | "dark";
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useTheme = create<ThemeState>((set) => {
  // Read initial value from localStorage (client-side only)
  const initial =
    typeof window !== "undefined"
      ? (localStorage.getItem("theme") as "light" | "dark") || "light"
      : "light";

  // Apply on init
  if (typeof window !== "undefined") {
    document.documentElement.classList.toggle("dark", initial === "dark");
  }

  return {
    theme: initial,

    toggleTheme: () =>
      set((state) => {
        const next = state.theme === "light" ? "dark" : "light";
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
        return { theme: next };
      }),

    setTheme: (theme) =>
      set(() => {
        localStorage.setItem("theme", theme);
        document.documentElement.classList.toggle("dark", theme === "dark");
        return { theme };
      }),
  };
});
