"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavCounts = {
  pendingAccounts: number;
  openIssues: number;
};

const TABS = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/contas", label: "Pendências", badge: "pendingAccounts" as const },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/lojas", label: "Lojas & eventos" },
  { href: "/admin/aliases", label: "Jogadores & aliases" },
  { href: "/admin/issues", label: "Issues", badge: "openIssues" as const },
  { href: "/admin/tabs", label: "Planilha" },
];

/** Navegação fixa entre as seções do painel admin. */
export function AdminNav({ counts }: { counts: AdminNavCounts }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="admin-nav" aria-label="Seções do admin">
      {TABS.map((t) => {
        const badge = t.badge ? counts[t.badge] : 0;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`admin-tab${isActive(t.href) ? " active" : ""}`}
            aria-current={isActive(t.href) ? "page" : undefined}
          >
            {t.label}
            {badge > 0 && <span className="admin-badge tnum">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
