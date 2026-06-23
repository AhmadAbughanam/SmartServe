import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  MenuRecommendationRequest,
  MenuRecommendationResponse,
} from "@smart-restaurant/shared-types";
import { post } from "../../lib/api";
import type { CartItem, MenuItem } from "../../lib/types";

const COPPER = "#0c0a09";
const COPPER_SOFT = "#f5f5f4";
const COPPER_EDGE = "#e7e5e4";
const COPPER_INK = "#1c1917";

type DisplayMode = "scroll" | "list";

export function RecommendedForYou({
  branchId,
  tenantId,
  sessionId,
  userId,
  cartItems,
  menuItems,
  onAddToCart,
  mode = "scroll",
  title = "Recommended for you",
  surface = "menu_home",
}: {
  branchId: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
  cartItems: CartItem[];
  menuItems: MenuItem[];
  onAddToCart: (item: CartItem) => void;
  mode?: DisplayMode;
  title?: string;
  surface?: "menu_home" | "cart" | "item_detail" | "checkout";
}) {
  const trigger = cartItems.length > 0 ? "cart_aware" : "empty_cart";

  const request: MenuRecommendationRequest = {
    branchId,
    tenantId,
    sessionId,
    userId,
    cartItems: cartItems.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
    })),
    limit: mode === "list" ? 4 : 6,
    surface,
    trigger,
  };

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      "menu-recommendations",
      branchId,
      tenantId ?? null,
      sessionId ?? null,
      userId ?? null,
      cartItems.map((item) => `${item.menuItemId}:${item.quantity}`).sort().join("|"),
      mode,
    ],
    queryFn: () =>
      post<MenuRecommendationResponse>("/api/recommendations/menu", request),
    enabled: Boolean(branchId),
    staleTime: 30_000,
  });

  const trackedImpressions = useRef(new Set<string>());

  useEffect(() => {
    if (!data?.recommendations) return;
    for (const item of data.recommendations) {
      if (!trackedImpressions.current.has(item.menuItemId)) {
        trackedImpressions.current.add(item.menuItemId);
        post("/api/recommendations/telemetry", {
          branchId,
          tenantId,
          sessionId,
          userId,
          menuItemId: item.menuItemId,
          interactionType: "IMPRESSION",
          surface,
        }).catch(() => {}); // silent fail for telemetry
      }
    }
  }, [data?.recommendations, branchId, tenantId, sessionId, userId, surface]);

  if (isLoading) {
    return (
      <section className={mode === "list" ? "mt-4" : "mb-5"}>
        <Header title={title} />
        <div className={mode === "list" ? "mt-2 space-y-2" : "-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2"}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={mode === "list" ? "h-[72px] animate-pulse rounded-[12px]" : "h-[126px] min-w-[150px] animate-pulse rounded-[12px]"}
              style={{ background: "var(--ink-100)", border: "1px solid var(--ink-200)" }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={mode === "list" ? "mt-4" : "mb-5"}>
        <div
          className="rounded-[12px] px-3 py-2 text-[11px]"
          style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}
        >
          Recommendations are unavailable right now.
        </div>
      </section>
    );
  }

  const recommendations = data?.recommendations ?? [];
  if (recommendations.length === 0) return null;

  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  const rows = recommendations
    .map((recommendation) => ({
      recommendation,
      menuItem: itemById.get(recommendation.menuItemId),
    }))
    .filter((row) => row.menuItem);

  if (rows.length === 0) return null;

  const handleAddToCart = (item: MenuItem) => {
    post("/api/recommendations/telemetry", {
      branchId,
      tenantId,
      sessionId,
      userId,
      menuItemId: item.id,
      interactionType: "ADD_TO_CART",
      surface,
    }).catch(() => {});
    
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      price: parseFloat(item.price),
      quantity: 1,
      additions: [],
    });
  };

  return (
    <section className={mode === "list" ? "mt-4" : "mb-5"}>
      <Header title={title} />
      <div className={mode === "list" ? "mt-2 space-y-2" : "-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 snap-x"} style={{ scrollbarWidth: "none" }}>
        {rows.map(({ recommendation, menuItem }) => {
          const item = menuItem!;
          return (
            <article
              key={recommendation.menuItemId}
              className={mode === "list" ? "flex items-center gap-3 rounded-[12px] p-3" : "min-w-[168px] snap-start rounded-[12px] p-3"}
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
            >
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
                  {recommendation.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug" style={{ color: "var(--ink-500)" }}>
                  {recommendation.reason}
                </p>
                <p className="mt-2 text-[11px] font-semibold" style={{ color: "var(--ink-800)" }}>
                  {parseFloat(item.price).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleAddToCart(item)}
                className={mode === "list" ? "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-white" : "mt-3 flex w-full items-center justify-center rounded-[10px] py-2 text-[12px] font-semibold text-white"}
                style={{ background: COPPER }}
                aria-label={`Add ${item.name} to cart`}
              >
                {mode === "list" ? (
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                ) : (
                  "Add"
                )}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Header({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}`, color: COPPER_INK }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.91 5.84L20 11l-6.09 2.16L12 19l-1.91-5.84L4 11l6.09-2.16z" />
        </svg>
      </span>
      <h3 className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>
        {title}
      </h3>
    </div>
  );
}
