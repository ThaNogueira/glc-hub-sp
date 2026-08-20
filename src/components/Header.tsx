"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Meta" },
  { href: "/agenda", label: "Agenda" },
  { href: "/rankings", label: "Rankings" },
  { href: "/decks", label: "Decks" },
  { href: "/jogadores", label: "Jogadores" },
  { href: "/lojas", label: "Lojas" },
];

export type HeaderUser = {
  displayName: string;
  role: "PLAYER" | "STORE" | "ADMIN";
  avatarUrl: string | null;
};

export function Header({ user }: { user: HeaderUser | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <div className="container">
        <Link href="/" className="brand" aria-label="GLC Hub SP — início">
          <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
            <path
              d="M32 3 L57 13 V33 C57 47 46 57 32 61 C18 57 7 47 7 33 V13 Z"
              fill="var(--accent)"
            />
            <circle cx="32" cy="31" r="10" fill="#fff" />
            <circle cx="32" cy="31" r="5" fill="var(--accent)" />
          </svg>
          GLC Hub SP
        </Link>
        <nav className="main-nav" aria-label="Navegação principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "active" : undefined}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          {user ? (
            <>
              {user.role === "ADMIN" && (
                <Link href="/admin" className="btn ghost small">
                  Admin
                </Link>
              )}
              {user.role === "STORE" && (
                <Link href="/loja" className="btn ghost small">
                  Minha loja
                </Link>
              )}
              <Link
                href="/conta"
                className="btn secondary small"
                title={`Conta de ${user.displayName}`}
              >
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
                  <span aria-hidden="true">👤</span>
                )}
                <span className="hide-sm">{user.displayName.split(" ")[0]}</span>
              </Link>
            </>
          ) : (
            <Link href="/entrar" className="btn small">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
