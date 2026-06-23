import TenantsAdminContent from "../internal/TenantsAdminContent";

type TenantsTab = "directory" | "branches" | "owners" | "provisioning";

export default async function SaasTenantsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const rawTab = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab;
  const tab: TenantsTab =
    rawTab === "branches" || rawTab === "owners" || rawTab === "provisioning"
      ? rawTab
      : "directory";

  return <TenantsAdminContent initialTab={tab} />;
}
