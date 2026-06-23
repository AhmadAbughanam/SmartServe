"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { customerGet, customerPost, get, getApiErrorMessage } from "../../../../../lib/api";
import { useCart, cartSubtotal } from "../../../../../lib/cart-store";
import { hasCustomerSession } from "../../../../../lib/customer-auth";
import type { MenuCategory, MenuItem, CartItem } from "../../../../../lib/types";
import { MenuChatAssistant } from "../../../../../components/ai/MenuChatAssistant";
import { RecommendedForYou } from "../../../../../components/recommendations/RecommendedForYou";
import { LoadingScreen, EmptyState, Cloche, ErrorDisplay } from "../../../../../components/ui";
import { resolveAssetUrl } from "../../../../../lib/media";

/* Burnished copper for the customer ordering screens — matches the design's amber tone. */
const COPPER = "#0c0a09";
const COPPER_DEEP = "#000000";
const COPPER_SOFT = "#f5f5f4";
const COPPER_EDGE = "#e7e5e4";

const photoGradients = [
  "linear-gradient(135deg, #c2841d, #6b4014)",
  "linear-gradient(135deg, #b85c2c, #5a2e16)",
  "linear-gradient(135deg, #166534, #052e16)",
  "linear-gradient(135deg, #9a3412, #431407)",
  "linear-gradient(135deg, #713f12, #422006)",
  "linear-gradient(135deg, #4c1d95, #2e1065)",
];
function photoGrad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return photoGradients[Math.abs(h) % photoGradients.length]; }
function imgUrl(url: string | null) { return resolveAssetUrl(url); }

/* ── Top bar — back / brand / cart-with-badge ─────── */
function TopBar({ cartCount, onBack, onCart }: { cartCount: number; onBack: () => void; onCart: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 2px rgba(12,10,9,0.04)" }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div className="flex flex-col items-center">
        <Cloche size={28} color={COPPER} />
        <div className="mt-1 font-serif text-[14px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</div>
        <div className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</div>
      </div>
      <button onClick={onCart} aria-label="View cart" className="relative flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 2px rgba(12,10,9,0.04)" }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: COPPER }}>{cartCount}</span>
        )}
      </button>
    </div>
  );
}

/* ── Info pill — Branch / Table / Guests ──────────── */
function Pill({ icon, primary, label }: { icon: React.ReactNode; primary: string; label?: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[12px] px-2.5 py-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>{icon}</span>
      <div className="min-w-0 flex-1">
        {label && <div className="text-[9px] leading-none" style={{ color: "var(--ink-500)" }}>{label}</div>}
        <div className={`${label ? "mt-0.5" : ""} text-[12px] font-semibold leading-tight truncate`} style={{ color: "var(--ink-900)" }}>{primary}</div>
      </div>
    </div>
  );
}

/* ── Recommended card — image-top, name+price-bottom ─ */
function FavoriteButton({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="flex h-7 w-7 items-center justify-center rounded-full transition active:scale-[0.94]"
      style={{ background: "rgba(255,255,255,0.95)", color: active ? "#dc2626" : "var(--ink-500)" }}
    >
      <svg width={13} height={13} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
    </button>
  );
}

function RecCard({ item, onOpen, isFavorite, onToggleFavorite }: { item: MenuItem; onOpen: (item: MenuItem) => void; isFavorite: boolean; onToggleFavorite: (item: MenuItem) => void }) {
  const photo = imgUrl(item.imageUrl);
  const disabled = item.isUnavailable;
  function open() {
    if (!disabled) onOpen(item);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(item);
    }
  }
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={handleKeyDown}
      className={`min-w-[150px] flex-shrink-0 overflow-hidden rounded-[12px] text-left transition active:scale-[0.97] ${disabled ? "opacity-40" : "cursor-pointer"}`}
      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="relative h-[130px] w-full" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(item.id) }}>
        <span className="absolute right-2 top-2"><FavoriteButton active={isFavorite} onToggle={() => onToggleFavorite(item)} label={`${isFavorite ? "Remove" : "Add"} ${item.name} favorite`} /></span>
      </div>
      <div className="flex flex-col p-2.5">
        <div className="text-[12px] font-semibold leading-tight min-h-[32px]" style={{ color: "var(--ink-900)" }}>{item.name}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold text-[12px]" style={{ color: "var(--ink-900)" }}>{parseFloat(item.price).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white" style={{ background: COPPER }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Regular grid item card ───────────────────────── */
function GridCard({ item, onOpen, isFavorite, onToggleFavorite }: { item: MenuItem; onOpen: (item: MenuItem) => void; isFavorite: boolean; onToggleFavorite: (item: MenuItem) => void }) {
  const photo = imgUrl(item.imageUrl);
  const disabled = item.isUnavailable;
  function open() {
    if (!disabled) onOpen(item);
  }
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen(item);
    }
  }
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={handleKeyDown}
      className={`overflow-hidden rounded-[12px] text-left transition active:scale-[0.97] ${disabled ? "opacity-40" : "cursor-pointer"}`}
      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="relative h-[120px] w-full" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(item.id) }}>
        <span className="absolute right-2 top-2"><FavoriteButton active={isFavorite} onToggle={() => onToggleFavorite(item)} label={`${isFavorite ? "Remove" : "Add"} ${item.name} favorite`} /></span>
      </div>
      <div className="p-2.5">
        <div className="text-[12px] font-semibold leading-tight min-h-[32px]" style={{ color: "var(--ink-900)" }}>{item.name}</div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold text-[12px]" style={{ color: "var(--ink-900)" }}>{parseFloat(item.price).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>
          {item.isUnavailable ? (
            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>sold out</span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] text-white" style={{ background: COPPER }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Item detail bottom sheet ─────────────────────── */
const SHEET_DURATION = 320; // ms — slide in/out duration

function ItemSheet({ item, onClose, onAddToCart, isFavorite, onToggleFavorite }: { item: MenuItem; onClose: () => void; onAddToCart: (c: CartItem) => void; isFavorite: boolean; onToggleFavorite: (item: MenuItem) => void }) {
  const [qty, setQty] = useState(1);
  const [selectedAdditions, setSelectedAdditions] = useState<Set<string>>(new Set());
  const [isOpen, setIsOpen] = useState(false); // false = below screen / hidden, true = visible
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const photo = imgUrl(item.imageUrl);
  const additionsTotal = item.additions.filter(a => selectedAdditions.has(a.id)).reduce((s, a) => s + parseFloat(a.priceImpact), 0);
  const unitTotal = parseFloat(item.price) + additionsTotal;
  const allergens = Array.isArray(item.allergensJson) ? item.allergensJson as string[] : null;

  // Lock background scroll while the sheet is mounted; trigger slide-in on next paint.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";

    // Run on next frame so the initial translateY(100%) state has rendered first,
    // then transition to translateY(0) for a clean slide-in.
    const id = requestAnimationFrame(() => setIsOpen(true));

    return () => {
      cancelAnimationFrame(id);
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  function handleClose() {
    setIsOpen(false);
    // Wait for the slide-out transition before unmounting.
    setTimeout(onClose, SHEET_DURATION);
  }

  function startDrag(clientY: number) {
    setDragStartY(clientY);
    setDragOffsetY(0);
  }

  function moveDrag(clientY: number) {
    if (dragStartY === null) return;
    setDragOffsetY(Math.max(0, clientY - dragStartY));
  }

  function endDrag() {
    if (dragStartY === null) return;
    const shouldClose = dragOffsetY > 90;
    setDragStartY(null);
    setDragOffsetY(0);
    if (shouldClose) handleClose();
  }

  function toggle(id: string) {
    const next = new Set(selectedAdditions);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedAdditions(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(12,10,9,0.45)",
        opacity: isOpen ? 1 : 0,
        transition: `opacity ${SHEET_DURATION}ms ease-out`,
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md flex flex-col rounded-t-[24px] overflow-hidden will-change-transform"
        style={{
          background: "var(--ink-0)",
          maxHeight: "92vh",
          transform: isOpen ? `translateY(${dragOffsetY}px)` : "translateY(100%)",
          transition: dragStartY === null ? `transform ${SHEET_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)` : "none",
          boxShadow: "0 -10px 40px -8px rgba(12,10,9,0.25)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle + close */}
        <div className="relative flex justify-center pt-3 pb-2 px-4">
          <button
            type="button"
            aria-label="Slide down to close item details"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              startDrag(event.clientY);
            }}
            onPointerMove={(event) => moveDrag(event.clientY)}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="h-3 w-16 rounded-full touch-none cursor-grab active:cursor-grabbing"
            style={{ background: "var(--ink-300)" }}
          />
          <button onClick={handleClose} aria-label="Close" className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {/* Hero row */}
          <div className="flex gap-3.5">
            <div className="h-[140px] w-[140px] flex-shrink-0 rounded-[14px]" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(item.id) }} />
            <div className="flex flex-1 flex-col min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-serif text-[18px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>{item.name}</h2>
                <button
                  type="button"
                  aria-label={`${isFavorite ? "Remove" : "Add"} ${item.name} favorite`}
                  onClick={() => onToggleFavorite(item)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center"
                  style={{ color: isFavorite ? "#dc2626" : COPPER }}
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                </button>
              </div>
              {/* Star rating — display only */}
              <div className="mt-1 flex items-center gap-1">
                {[1, 2, 3, 4].map(i => <svg key={i} width={11} height={11} viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth={1.5}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)}
                {/* half-star */}
                <svg width={11} height={11} viewBox="0 0 24 24"><defs><linearGradient id="halfstar"><stop offset="50%" stopColor="#f59e0b" /><stop offset="50%" stopColor="white" stopOpacity="0" /></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#halfstar)" stroke="#f59e0b" strokeWidth={1.5} /></svg>
                <span className="ml-1 text-[10px] font-medium" style={{ color: "var(--ink-700)" }}>4.6</span>
                <span className="text-[10px]" style={{ color: "var(--ink-500)" }}>(128)</span>
              </div>
              {item.description && <p className="mt-2 text-[12px] leading-snug" style={{ color: "var(--ink-600)" }}>{item.description}</p>}
              <div className="mt-2.5 font-semibold text-[18px]" style={{ color: "var(--ink-900)" }}>
                {parseFloat(item.price).toFixed(2)} <span className="text-[10px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-3 self-start rounded-[10px] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="text-[14px] font-semibold" style={{ color: "var(--ink-700)" }} aria-label="decrease">−</button>
                <span className="font-semibold text-[14px] w-4 text-center">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="text-[14px] font-semibold" style={{ color: "var(--ink-700)" }} aria-label="increase">+</button>
              </div>
            </div>
          </div>

          {allergens && allergens.length > 0 && (
            <div className="mt-3 rounded-[10px] p-2.5" style={{ background: "var(--warn-soft)", border: "1px solid #fde68a" }}>
              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--warn)" }}>Allergens</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "#78350f" }}>{allergens.join(" · ")}</div>
            </div>
          )}

          {/* Add extras */}
          {item.additions.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--ink-200)" }}>
              <h3 className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>
                Add extras <span className="font-normal text-[12px]" style={{ color: "var(--ink-500)" }}>(optional)</span>
              </h3>
              <div className="mt-2.5">
                {item.additions.map(a => {
                  const checked = selectedAdditions.has(a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggle(a.id)} className="flex w-full items-center justify-between py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="flex h-5 w-5 items-center justify-center rounded-[5px] transition" style={{ background: checked ? COPPER : "var(--ink-0)", border: `1.5px solid ${checked ? COPPER : "var(--ink-300)"}` }}>
                          {checked && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </span>
                        <span className="text-[13px]" style={{ color: "var(--ink-900)" }}>{a.name}</span>
                      </span>
                      <span className="text-[12px]" style={{ color: "var(--ink-700)" }}>+ {parseFloat(a.priceImpact).toFixed(2)} <span style={{ color: "var(--ink-500)" }}>JOD</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add to Cart bar */}
        <div className="px-4 pb-5 pt-3">
          <button
            onClick={() => {
              onAddToCart({
                menuItemId: item.id,
                name: item.name,
                price: parseFloat(item.price),
                quantity: qty,
                additions: item.additions.filter(a => selectedAdditions.has(a.id)).map(a => ({ additionId: a.id, name: a.name, priceImpact: parseFloat(a.priceImpact) })),
              });
              handleClose();
            }}
            className="flex w-full items-center justify-center gap-3 rounded-[14px] py-4 text-[14px] font-semibold text-white transition active:scale-[0.98]"
            style={{ background: COPPER }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            Add to Cart <span className="opacity-70">&middot;</span> <span className="font-semibold">{(unitTotal * qty).toFixed(2)} <span className="text-[10px] font-normal opacity-80">JOD</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
export default function MenuPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { state, dispatch } = useCart();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasCustomerAuth, setHasCustomerAuth] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | "ALL" | "RECOMMENDED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const branchId = state.branchId ?? "seed-branch-1";

  useEffect(() => {
    setHasCustomerAuth(hasCustomerSession());
  }, []);

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
  });

  const { refetch: refetchFavorites } = useQuery({
    queryKey: ["menu-favorites", branchId, hasCustomerAuth],
    queryFn: async () => {
      if (!hasCustomerAuth) return { favoriteMenuItemIds: [] as string[] };
      const response = await customerGet<{ favoriteMenuItemIds: string[] }>(`/api/menu/favorites?branchId=${branchId}`);
      setFavoriteIds(new Set(response.favoriteMenuItemIds));
      return response;
    },
    enabled: hasCustomerAuth && !!branchId,
  });

  const cartCount = state.items.reduce((s, i) => s + i.quantity, 0);
  const q = searchQuery.toLowerCase().trim();
  const filteredCategories = categories
    ?.map(c => q ? { ...c, menuItems: c.menuItems.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) } : c)
    .filter(c => c.menuItems.length > 0);

  const visibleCategories = activeCategory === "ALL"
    ? filteredCategories
    : filteredCategories?.filter(c => c.id === activeCategory);

  const allMenuItems = categories?.flatMap(c => c.menuItems) ?? [];

  async function toggleFavorite(item: MenuItem) {
    if (!hasCustomerAuth) {
      router.push("/customer/login");
      return;
    }

    const nextFavorite = !favoriteIds.has(item.id);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (nextFavorite) next.add(item.id);
      else next.delete(item.id);
      return next;
    });

    try {
      await customerPost(`/api/menu/items/${item.id}/favorite`, undefined, {
        branchId,
        favorite: nextFavorite,
      });
      void refetchFavorites();
    } catch {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (nextFavorite) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
    }
  }

  if (isLoading) return <LoadingScreen message="Loading menu..." />;
  if (error) return <ErrorDisplay message={getApiErrorMessage(error, "The menu is unavailable for this table session.")} />;

  return (
    <main className="relative flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col">
        {/* Sticky region */}
        <div className="sticky top-0 z-30 pb-2.5" style={{ background: "var(--ink-50)" }}>
          <TopBar cartCount={cartCount} onBack={() => router.back()} onCart={() => router.push(`/customer/session/${sessionId}/cart`)} />

          {/* Info pills */}
          <div className="mt-4 flex gap-2 px-4">
            <Pill
              icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>}
              primary={state.branchName ?? "Branch"}
            />
            <Pill
              icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" /><path d="M5 7h14" /><line x1="8" y1="20" x2="8" y2="16" /><line x1="16" y1="20" x2="16" y2="16" /></svg>}
              label="Table"
              primary={state.tableCode ?? "—"}
            />
            <Pill
              icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
              primary={`${state.guestCount ?? 1} Guest${(state.guestCount ?? 1) === 1 ? "" : "s"}`}
            />
          </div>

          {/* Search */}
          <div className="mt-3 px-4">
            <div className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search dishes or drinks"
                className="flex-1 bg-transparent text-[13px] outline-none"
                style={{ color: "var(--ink-900)" }}
              />
              <button type="button" onClick={() => setChatOpen(true)} aria-label="Open menu assistant" data-testid="menu-chat-open" style={{ color: "var(--ink-500)" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>
              </button>
            </div>
          </div>

          {/* Category chips */}
          <div className="mt-3 flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: "none" }}>
            {[
              { key: "ALL" as const, label: "All" },
              ...(categories?.map(c => ({ key: c.id, label: c.name })) ?? []),
            ].map(c => {
              const active = activeCategory === c.key;
              return (
                <button key={c.key} onClick={() => setActiveCategory(c.key)}
                  className="flex-shrink-0 whitespace-nowrap rounded-[12px] px-4 py-2 text-[12px] font-semibold transition"
                  style={{
                    background: active ? COPPER : "var(--ink-0)",
                    color: active ? "#fff" : "var(--ink-700)",
                    border: `1px solid ${active ? COPPER : "var(--ink-200)"}`,
                  }}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-4 pb-32 pt-2">
          {/* Recommended */}
          {activeCategory === "ALL" && !q && (
            <RecommendedForYou
              branchId={branchId}
              sessionId={sessionId}
              cartItems={state.items}
              menuItems={allMenuItems}
              onAddToCart={(item) => dispatch({ type: "ADD_ITEM", item })}
              mode="scroll"
            />
          )}

          {/* Categories grid */}
          {visibleCategories?.map(cat => (
            <div key={cat.id} className="mb-5">
              {(activeCategory === "ALL" || activeCategory === cat.id) && (
                <h2 className="mb-2.5 font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>{cat.name}</h2>
              )}
              <div className="grid grid-cols-2 gap-3">
                {cat.menuItems.map(item => (
                  <GridCard
                    key={item.id}
                    item={item}
                    onOpen={setSelectedItem}
                    isFavorite={favoriteIds.has(item.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </div>
          ))}

          {visibleCategories && visibleCategories.length === 0 && (
            <EmptyState icon="*" title={q ? "No matches" : "Menu is empty"} description={q ? "Try a different search or category." : "There are no available items for this branch right now."} />
          )}
        </div>
      </div>

      {selectedItem && (
        <ItemSheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={c => dispatch({ type: "ADD_ITEM", item: c })}
          isFavorite={favoriteIds.has(selectedItem.id)}
          onToggleFavorite={toggleFavorite}
        />
      )}
      <MenuChatAssistant
        branchId={branchId}
        sessionId={sessionId}
        cartItems={state.items}
        menuItems={allMenuItems}
        onAddToCart={(item) => dispatch({ type: "ADD_ITEM", item })}
        open={chatOpen}
        onOpenChange={setChatOpen}
      />

      {/* Floating cart CTA when items present */}
      {cartCount > 0 && (
        <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-md">
          <button onClick={() => router.push(`/customer/session/${sessionId}/cart`)}
            className="flex w-full items-center justify-between rounded-[14px] px-4 py-3.5 text-white shadow-lg active:scale-[0.98]"
            style={{ background: COPPER, boxShadow: "0 12px 28px -8px rgba(194,132,29,0.55)" }}>
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: "rgba(255,255,255,0.22)" }}>{cartCount}</span>
              <span className="text-[13px] font-semibold">View Cart</span>
            </span>
            <span className="font-semibold text-[13px]">{cartSubtotal(state.items).toFixed(2)} <span className="text-[10px] font-normal opacity-85">JOD</span></span>
          </button>
        </div>
      )}

      <style jsx>{`
        :global(.color-copper-deep) { color: ${COPPER_DEEP}; }
        :global(.bg-copper-soft) { background: ${COPPER_SOFT}; }
        :global(.border-copper-edge) { border-color: ${COPPER_EDGE}; }
      `}</style>
    </main>
  );
}
