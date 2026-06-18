"use client";

import { useEffect, useState } from "react";

const storageKey = "clustersage-theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey) as Theme | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const next = stored === "dark" || stored === "light" ? stored : preferred;
    setTheme(next);
    applyTheme(next);
    setReady(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(storageKey, next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className="btn-secondary h-11 w-11 rounded-2xl p-0"
      onClick={toggle}
      aria-label={ready ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
      title={ready ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Toggle theme"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v2.5M12 18.5V21M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M3 12h2.5M18.5 12H21M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4.25" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
