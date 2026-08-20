"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark =
      root.dataset.theme === "dark" ||
      (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  return (
    <button type="button" className="secondary small" onClick={toggle} aria-label="Alternar tema">
      ☀︎/☾
    </button>
  );
}
