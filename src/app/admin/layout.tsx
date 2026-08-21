import { AdminNav, type AdminNavCounts } from "@/components/AdminNav";
import { isAdmin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Layout do painel admin: navegação fixa entre as seções em todas as páginas
 * (some na tela de login, onde ainda não há sessão de admin).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let counts: AdminNavCounts | null = null;

  if (await isAdmin()) {
    try {
      const [claims, stores, issues] = await Promise.all([
        prisma.profileClaim.count({ where: { status: "PENDING" } }),
        prisma.storeRequest.count({ where: { status: "PENDING" } }),
        prisma.reconciliationIssue.count({ where: { status: "OPEN" } }),
      ]);
      counts = { pendingAccounts: claims + stores, openIssues: issues };
    } catch {
      counts = { pendingAccounts: 0, openIssues: 0 };
    }
  }

  return (
    <>
      {counts && <AdminNav counts={counts} />}
      {children}
    </>
  );
}
