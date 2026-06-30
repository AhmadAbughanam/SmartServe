import MenuPageClient from "./MenuPageClient";
import { serverGet } from "../../../../../lib/server-api";
import type { MenuCategory, PublicSessionSummary } from "../../../../../lib/types";

interface MenuPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { sessionId } = await params;
  const session = await serverGet<PublicSessionSummary>(`/api/sessions/${sessionId}/public`);
  const categories = await serverGet<MenuCategory[]>(`/api/menu?branchId=${session.branchId}`);

  return (
    <MenuPageClient
      sessionId={sessionId}
      initialBranchId={session.branchId}
      initialBranchName={session.branchName}
      initialTableCode={session.tableCode}
      initialGuestCount={session.guestCount}
      initialCategories={categories}
    />
  );
}
