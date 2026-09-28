"use client";

import { useEffect, useState } from "react";

// Theme toggle.
//
// The chosen theme is written to <html data-theme> and mirrored to
// localStorage. The inline script in the layout applies the stored
// value before first paint, so there is no flash of the wrong theme
// on load — which matters more here than usual, since flashing a
// bright page at someone working in the dark is genuinely
// unpleasant.
//
// With no stored preference we follow the system setting, and keep
// following it until the user makes an explicit choice.

export type Theme = "light" | "dark";

export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var stored = localStorage.getItem('unybase-theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("unybase-theme", next);
    } catch {
      // Private browsing or storage disabled: the toggle still works
      // for this session, it just will not be remembered.
    }
  }

  // Render a placeholder until mounted so the server and client
  // markup agree; the real icon depends on a value only the browser
  // knows.
  const label = !mounted
    ? "Theme"
    : theme === "dark"
      ? "Switch to light theme"
      : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        width: compact ? 34 : undefined,
        height: 34,
        padding: compact ? 0 : "0 12px",
        borderRadius: 8,
        border: "1px solid var(--line)",
        background: "transparent",
        color: "var(--paper-dim)",
        cursor: "pointer",
        fontSize: "0.8rem",
      }}
    >
      {mounted && theme === "light" ? <MoonIcon /> : <SunIcon />}
      {!compact ? (
        <span>{mounted && theme === "light" ? "Dark" : "Light"}</span>
      ) : null}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
