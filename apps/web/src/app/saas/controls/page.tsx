import ControlsOwnerContent from "../internal/ControlsOwnerContent";

type ControlsTab = "modules" | "ai" | "diagnostics" | "presets";

const tabs: Array<{ key: ControlsTab; label: string }> = [
  { key: "modules", label: "Modules" },
  { key: "ai", label: "AI Controls" },
  { key: "diagnostics", label: "Diagnostics" },
  { key: "presets", label: "Presets" },
];

export default async function SaasControlsOwnerPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const rawTab = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab;
  const tab: ControlsTab =
    rawTab === "ai" || rawTab === "diagnostics" || rawTab === "presets" ? rawTab : "modules";

  return <ControlsOwnerContent initialTab={tab} />;
}
