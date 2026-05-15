"use client";

type CategoryKind =
  | "STARTERS"
  | "MAINS"
  | "DRINKS"
  | "DESSERTS"
  | "BREAKFAST"
  | "SALADS"
  | "SIDES"
  | "PIZZA"
  | "SEAFOOD"
  | "OTHER";

const CATEGORY_META: Record<CategoryKind, { label: string; color: string; bg: string }> = {
  STARTERS: { label: "Starters", color: "#c2410c", bg: "#ffedd5" },
  MAINS: { label: "Mains", color: "#b91c1c", bg: "#fee2e2" },
  DRINKS: { label: "Drinks", color: "#2563eb", bg: "#dbeafe" },
  DESSERTS: { label: "Desserts", color: "#be123c", bg: "#ffe4e6" },
  BREAKFAST: { label: "Breakfast", color: "#a16207", bg: "#fef3c7" },
  SALADS: { label: "Salads", color: "#15803d", bg: "#dcfce7" },
  SIDES: { label: "Sides", color: "#7c3aed", bg: "#ede9fe" },
  PIZZA: { label: "Pizza", color: "#dc2626", bg: "#fee2e2" },
  SEAFOOD: { label: "Seafood", color: "#0369a1", bg: "#e0f2fe" },
  OTHER: { label: "Menu", color: "#64748b", bg: "#f1f5f9" },
};

export function menuCategoryKind(name: string): CategoryKind {
  const n = name.toLowerCase();
  if (/(starter|appetizer|mezze|small|share)/.test(n)) return "STARTERS";
  if (/(main|course|burger|pasta|grill|steak|entree|meal)/.test(n)) return "MAINS";
  if (/(drink|beverage|juice|coffee|tea|soda|cola|water)/.test(n)) return "DRINKS";
  if (/(dessert|sweet|cake|ice|pastry)/.test(n)) return "DESSERTS";
  if (/(breakfast|brunch|egg)/.test(n)) return "BREAKFAST";
  if (/(salad|green|vegetarian|vegan)/.test(n)) return "SALADS";
  if (/(side|fries|snack|extra|addon|add-on)/.test(n)) return "SIDES";
  if (/(pizza|flatbread)/.test(n)) return "PIZZA";
  if (/(seafood|fish|shrimp|prawn|salmon|tuna)/.test(n)) return "SEAFOOD";
  return "OTHER";
}

export function menuCategoryMeta(name: string) {
  return CATEGORY_META[menuCategoryKind(name)];
}

export function MenuCategoryIcon({ name, size = 26 }: { name: string; size?: number }) {
  const kind = menuCategoryKind(name);
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "STARTERS") return <svg {...props}><path d="M5 12h14" /><path d="M6 16h12" /><path d="M8 8h8" /><path d="M4 20h16" /></svg>;
  if (kind === "MAINS") return <svg {...props}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M4 4l3 3" /><path d="m20 4-3 3" /></svg>;
  if (kind === "DRINKS") return <svg {...props}><path d="M8 2h8l-1 7H9L8 2Z" /><path d="M9 9h6l1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L9 9Z" /><path d="M9 14h6" /></svg>;
  if (kind === "DESSERTS") return <svg {...props}><path d="M4 11h16" /><path d="M5 11l2 9h10l2-9" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M10 5c0-2 4-2 4 0" /></svg>;
  if (kind === "BREAKFAST") return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M4 12h2" /><path d="M18 12h2" /><path d="M12 4v2" /><path d="M12 18v2" /></svg>;
  if (kind === "SALADS") return <svg {...props}><path d="M12 21c4-3 6-7 6-11a6 6 0 0 0-12 0c0 4 2 8 6 11Z" /><path d="M12 21V10" /><path d="M8 8c2 .5 3 1.5 4 3" /><path d="M16 8c-2 .5-3 1.5-4 3" /></svg>;
  if (kind === "SIDES") return <svg {...props}><path d="M7 3h10l-1 18H8L7 3Z" /><path d="M9 7h6" /><path d="M10 11h4" /></svg>;
  if (kind === "PIZZA") return <svg {...props}><path d="M12 2 3 21l18-7L12 2Z" /><circle cx="12" cy="10" r="1" /><circle cx="10" cy="15" r="1" /><circle cx="15" cy="14" r="1" /></svg>;
  if (kind === "SEAFOOD") return <svg {...props}><path d="M3 12s4-5 9-5 9 5 9 5-4 5-9 5-9-5-9-5Z" /><path d="M18 12l3-3v6l-3-3Z" /><circle cx="9" cy="11" r="1" /></svg>;
  return <svg {...props}><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /><path d="M8 4v16" /></svg>;
}
