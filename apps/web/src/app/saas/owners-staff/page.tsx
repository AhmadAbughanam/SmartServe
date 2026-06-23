import { redirect } from "next/navigation";

export default function SaasOwnersStaffCompatibilityPage() {
  redirect("/saas/tenants?tab=owners");
}
