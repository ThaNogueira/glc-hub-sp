"use client";

/** Dark é o padrão do site; o toggle alterna para light e persiste a escolha. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isLight = root.dataset.theme === "light";
    if (isLight) {
      delete root.dataset.theme; // volta ao padrão (dark)
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    } else {
      root.dataset.theme = "light";
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    }
  }
  return (
    <button
      type="button"
      className="ghost small"
      onClick={toggle}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema"
    >
      ☀︎/☾
    </button>
  );
}
