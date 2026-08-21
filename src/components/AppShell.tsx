"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export type ShellUser = {
  displayName: string;
  role: "PLAYER" | "STORE" | "ADMIN";
  avatarUrl: string | null;
};

type NavItem = { href: string; label: string; icon: React.ReactNode };

const I = {
  chart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.2 15.9A10 10 0 1 1 8 2.8" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  trophy: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 0 0 12 0V3H6z" />
      <path d="M6 5H3v2a4 4 0 0 0 4 4M18 5h3v2a4 4 0 0 1-4 4" />
      <path d="M12 15v4M8 21h8" />
    </svg>
  ),
  cards: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="13" height="16" rx="2" transform="rotate(-6 3 5)" />
      <rect x="8" y="4" width="13" height="16" rx="2" transform="rotate(6 8 4)" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a7 7 0 0 1 14 0v1" />
      <path d="M17 4a4 4 0 0 1 0 8M22 21v-1a7 7 0 0 0-4-6.3" />
    </svg>
  ),
  store: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 12v9h14v-9M9 21v-6h6v6" />
    </svg>
  ),
  ban: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  ),
  book: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" />
      <path d="M20 17v5H6.5a2.5 2.5 0 0 1 0-5" />
    </svg>
  ),
  shield: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
    </svg>
  ),
};

const NAV: NavItem[] = [
  { href: "/", label: "Meta", icon: I.chart },
  { href: "/agenda", label: "Agenda", icon: I.calendar },
  { href: "/rankings", label: "Rankings", icon: I.trophy },
  { href: "/decks", label: "Decks", icon: I.cards },
  { href: "/jogadores", label: "Jogadores", icon: I.users },
  { href: "/lojas", label: "Lojas", icon: I.store },
  { href: "/banlist", label: "Banlist", icon: I.ban },
  { href: "/regras", label: "Regras", icon: I.book },
];

export function AppShell({
  user,
  footer,
  children,
}: {
  user: ShellUser | null;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [desktopClosed, setDesktopClosed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setDesktopClosed(localStorage.getItem("navClosed") === "1");
    } catch {}
  }, []);

  // fecha o drawer mobile ao navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = useCallback(() => {
    if (window.matchMedia("(max-width: 1000px)").matches) {
      setMobileOpen((v) => !v);
    } else {
      setDesktopClosed((v) => {
        try {
          localStorage.setItem("navClosed", v ? "0" : "1");
        } catch {}
        return !v;
      });
    }
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const items: NavItem[] = [
    ...NAV,
    ...(user?.role === "STORE" ? [{ href: "/loja", label: "Minha loja", icon: I.store }] : []),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Admin", icon: I.shield }] : []),
  ];

  return (
    <div
      className={`app-shell${desktopClosed ? " nav-closed" : ""}${mobileOpen ? " nav-open" : ""}`}
    >
      <aside className="sidebar" aria-label="Menu lateral">
        <div className="sidebar-head">
          <Link href="/" className="sidebar-brand" aria-label="GLC Hub — início">
            <LogoMark height={30} />
          </Link>
          <button
            type="button"
            className="ghost icon-btn"
            onClick={toggle}
            aria-label="Fechar menu"
            title="Fechar menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegação principal">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <ThemeToggle />
          <Link href="/creditos" className="small muted">
            Créditos
          </Link>
        </div>
      </aside>

      <div
        className="sidebar-backdrop"
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="ghost icon-btn"
            onClick={toggle}
            aria-label="Abrir/fechar menu"
            title="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <Link href="/" className="topbar-brand" aria-label="GLC Hub — início">
            <LogoMark height={26} />
          </Link>
          <div style={{ flex: 1 }} />
          {user ? (
            <Link href="/conta" className="btn secondary small" title={`Conta de ${user.displayName}`}>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={20}
                  height={20}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-1a8 8 0 0 1 16 0v1" />
                </svg>
              )}
              <span className="hide-sm">{user.displayName.split(" ")[0]}</span>
            </Link>
          ) : (
            <Link href="/entrar" className="btn small">
              Entrar
            </Link>
          )}
        </header>

        <main className="container">{children}</main>
        {footer}
      </div>
    </div>
  );
}
