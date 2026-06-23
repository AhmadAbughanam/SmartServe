import BillingOwnerContent from "../internal/BillingOwnerContent";

type BillingTab = "subscriptions" | "invoices" | "risk" | "network-sales";

const tabs: Array<{ key: BillingTab; label: string }> = [
  { key: "subscriptions", label: "Subscriptions" },
  { key: "invoices", label: "Invoices" },
  { key: "risk", label: "Billing Risk" },
  { key: "network-sales", label: "Network Sales" },
];

export default async function SaasBillingOwnerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const rawTab = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab;
  const tab: BillingTab =
    rawTab === "subscriptions" || rawTab === "invoices" || rawTab === "risk" ? rawTab : "network-sales";

  return <BillingOwnerContent initialTab={tab} />;
}
