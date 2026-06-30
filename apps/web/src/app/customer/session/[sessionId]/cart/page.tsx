import CartPageClient from "./CartPageClient";
import { serverGet } from "../../../../../lib/server-api";
import type { MenuCategory, PublicSessionSummary } from "../../../../../lib/types";

interface CartPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { sessionId } = await params;
  const session = await serverGet<PublicSessionSummary>(`/api/sessions/${sessionId}/public`);
  const categories = await serverGet<MenuCategory[]>(`/api/menu?branchId=${session.branchId}`);

  return (
    <CartPageClient
      sessionId={sessionId}
      initialBranchId={session.branchId}
      initialBranchName={session.branchName}
      initialTableCode={session.tableCode}
      initialGuestCount={session.guestCount}
      initialCategories={categories}
    />
  );
}
