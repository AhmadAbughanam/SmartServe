import { redirect } from "next/navigation";

export default function SaasAiCompatibilityPage() {
  redirect("/saas/controls?tab=ai");
}
