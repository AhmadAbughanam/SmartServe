import { redirect } from "next/navigation";

export default function SaasRevenueCompatibilityPage() {
  redirect("/saas/billing?tab=network-sales");
}
