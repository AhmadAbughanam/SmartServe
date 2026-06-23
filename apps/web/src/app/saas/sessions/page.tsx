import { redirect } from "next/navigation";

export default function SaasSessionsCompatibilityPage() {
  redirect("/saas/operations?tab=sessions");
}
