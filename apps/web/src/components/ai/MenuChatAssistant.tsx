"use client";

import { useEffect, useMemo, useState } from "react";
import type { MenuChatResponse } from "@smart-restaurant/shared-types";
import { post } from "../../lib/api";
import type { CartItem, MenuItem } from "../../lib/types";

const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const COPPER_INK = "#7c5511";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  suggestedItems?: MenuChatResponse["suggestedItems"];
  safetyNotes?: string[];
  requiresStaffHelp?: boolean;
  staffHelpReason?: MenuChatResponse["staffHelpReason"];
};

const EXAMPLE_PROMPTS = [
  "What do you recommend?",
  "Something budget-friendly",
  "What is ready fast?",
  "Good for kids?",
  "No dairy",
  "What goes well with my cart?",
];

const photoGradients = [
  "linear-gradient(135deg, #c2841d, #6b4014)",
  "linear-gradient(135deg, #b85c2c, #5a2e16)",
  "linear-gradient(135deg, #166534, #052e16)",
  "linear-gradient(135deg, #9a3412, #431407)",
  "linear-gradient(135deg, #713f12, #422006)",
];

function photoGrad(id: string) {
  let hash = 0;
  for (const char of id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return photoGradients[Math.abs(hash) % photoGradients.length];
}

function imgUrl(url: string | null) {
  if (!url) return null;
  return url.startsWith("/") ? `http://localhost:4000${url}` : url;
}

function staffHelpLabel(reason: MenuChatResponse["staffHelpReason"]) {
  switch (reason) {
    case "ALLERGEN_UNCERTAIN":
      return "Ask staff about allergies";
    case "INGREDIENT_UNCERTAIN":
      return "Ask staff about ingredients";
    case "POLICY_OR_PAYMENT":
      return "Ask staff for details";
    case "CUSTOM_PREPARATION":
      return "Ask staff to customize";
    case "NO_SAFE_MENU_MATCH":
      return "Ask staff";
    default:
      return "Ask staff";
  }
}

export function MenuChatAssistant({
  branchId,
  tenantId,
  sessionId,
  userId,
  cartItems,
  menuItems,
  onAddToCart,
  open,
  onOpenChange,
}: {
  branchId: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
  cartItems: CartItem[];
  menuItems: MenuItem[];
  onAddToCart: (item: CartItem) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);

  function setOpen(next: boolean) {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  }

  const itemById = useMemo(
    () => new Map(menuItems.map((item) => [item.id, item])),
    [menuItems],
  );

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => setSheetVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  function closeSheet() {
    setSheetVisible(false);
    window.setTimeout(() => setOpen(false), 260);
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
    if (shouldClose) closeSheet();
  }

  async function sendMessage(message: string) {
    const text = message.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await post<MenuChatResponse>("/api/ai/menu-chat", {
        branchId,
        tenantId,
        sessionId,
        userId,
        message: text,
        cartItems: cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
      }, {
        signal: controller.signal,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.reply,
          suggestedItems: response.suggestedItems,
          safetyNotes: response.safetyNotes,
          requiresStaffHelp: response.requiresStaffHelp,
          staffHelpReason: response.staffHelpReason,
        },
      ]);
    } catch (requestError) {
      const timedOut =
        requestError instanceof DOMException && requestError.name === "AbortError";
      setError(
        timedOut
          ? "Menu assistant took too long to respond."
          : "Menu assistant is unavailable right now.",
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: timedOut
            ? "I couldn't get a response in time. You can keep browsing the menu."
            : "I couldn't answer that right now. You can keep browsing the menu.",
        },
      ]);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  if (!isOpen && !onOpenChange) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu assistant"
        data-testid="menu-chat-open"
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-[16px] text-white shadow-lg transition active:scale-[0.97]"
        style={{ background: COPPER, boxShadow: "0 12px 28px -8px rgba(194,132,29,0.55)" }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>
    );
  }

  if (!isOpen) return null;

  return (
    <div
      data-testid="menu-chat-panel"
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(12,10,9,0.35)",
        opacity: sheetVisible ? 1 : 0,
        transition: "opacity 260ms ease-out",
      }}
      onClick={closeSheet}
    >
      <div
      className="flex h-[52vh] w-full max-w-md flex-col overflow-hidden rounded-t-[24px]"
      style={{
        background: "var(--ink-0)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 -10px 40px -8px rgba(12,10,9,0.25)",
        transform: sheetVisible
          ? `translateY(${dragOffsetY}px)`
          : "translateY(100%)",
        transition: dragStartY === null
          ? "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)"
          : "none",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex justify-center pb-2 pt-3">
        <button
          type="button"
          onClick={closeSheet}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            startDrag(event.clientY);
          }}
          onPointerMove={(event) => moveDrag(event.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-label="Slide down to close menu assistant"
          className="h-3 w-16 rounded-full touch-none cursor-grab active:cursor-grabbing"
          style={{ background: "var(--ink-300)" }}
        />
      </div>
      <div className="flex items-center justify-between px-4 pb-3" style={{ background: COPPER_SOFT, borderBottom: `1px solid ${COPPER_EDGE}` }}>
        <div>
          <p className="text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Menu Assistant</p>
          <p className="mt-0.5 text-[11px]" style={{ color: COPPER_INK }}>Answers from this branch menu</p>
        </div>
        <button
          type="button"
          onClick={closeSheet}
          aria-label="Close menu assistant"
          className="flex h-8 w-8 items-center justify-center rounded-[10px]"
          style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-auto p-3" style={{ background: "var(--ink-50)", minHeight: 220 }}>
        {messages.length === 0 && (
          <div className="rounded-[14px] p-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                  style={{ background: COPPER_SOFT, color: COPPER_INK, border: `1px solid ${COPPER_EDGE}` }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[88%] rounded-[14px] px-3 py-2 text-[12px] leading-snug"
              style={{
                background: message.role === "user" ? COPPER : "var(--ink-0)",
                color: message.role === "user" ? "#fff" : "var(--ink-800)",
                border: message.role === "user" ? `1px solid ${COPPER}` : "1px solid var(--ink-200)",
              }}
            >
              <p>{message.text}</p>
              {message.safetyNotes && message.safetyNotes.length > 0 && (
                <div className="mt-2 space-y-1 rounded-[10px] px-2 py-1.5 text-[10px]" style={{ background: "var(--warn-soft)", color: "#78350f", border: "1px solid #fde68a" }}>
                  {message.safetyNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              )}
              {message.role === "assistant" && sessionId && message.requiresStaffHelp ? (
                <button
                  type="button"
                  onClick={() =>
                    post(`/api/sessions/${sessionId}/service-requests`, { type: "CALL_WAITER" }).catch(() => {
                      setError("Could not call a waiter right now.");
                    })
                  }
                  className="mt-2 rounded-[10px] px-3 py-1.5 text-[10px] font-bold"
                  style={{ background: COPPER_SOFT, color: COPPER_INK, border: `1px solid ${COPPER_EDGE}` }}
                >
                  {staffHelpLabel(message.staffHelpReason)}
                </button>
              ) : null}
              {message.suggestedItems && message.suggestedItems.length > 0 && (
                <SuggestedItems
                  suggestedItems={message.suggestedItems}
                  itemById={itemById}
                  onAddToCart={onAddToCart}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div data-testid="menu-chat-loading" className="rounded-[14px] px-3 py-2" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: "var(--ink-300)", animationDelay: `${dot * 120}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div data-testid="menu-chat-error" className="rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
        className="flex gap-2 p-3"
        style={{ background: "var(--ink-0)", borderTop: "1px solid var(--ink-200)" }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about the menu"
          maxLength={500}
          disabled={loading}
          className="min-w-0 flex-1 rounded-[12px] px-3 py-2.5 text-[13px] outline-none"
          style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-[12px] px-4 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
          style={{ background: COPPER }}
        >
          Send
        </button>
      </form>
      </div>
    </div>
  );
}

function SuggestedItems({
  suggestedItems,
  itemById,
  onAddToCart,
}: {
  suggestedItems: MenuChatResponse["suggestedItems"];
  itemById: Map<string, MenuItem>;
  onAddToCart: (item: CartItem) => void;
}) {
  const rows = suggestedItems
    .map((suggestion) => ({
      suggestion,
      item: itemById.get(suggestion.menuItemId),
    }))
    .filter((row): row is { suggestion: MenuChatResponse["suggestedItems"][number]; item: MenuItem } =>
      Boolean(row.item && row.item.isActive && !row.item.isUnavailable),
    );

  if (rows.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {rows.map(({ suggestion, item }) => {
        const photo = imgUrl(item.imageUrl);
        return (
          <div
            key={suggestion.menuItemId}
            data-testid="menu-chat-suggestion"
            className="flex gap-2 rounded-[12px] p-2"
            style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}
          >
            <div className="h-12 w-12 flex-shrink-0 rounded-[9px]" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(item.id) }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>{item.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[10px]" style={{ color: "var(--ink-500)" }}>{suggestion.reason}</p>
              <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--ink-800)" }}>
                {parseFloat(item.price).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onAddToCart({
                  menuItemId: item.id,
                  name: item.name,
                  price: parseFloat(item.price),
                  quantity: 1,
                  additions: [],
                })
              }
              aria-label={`Add ${item.name} to cart`}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-white"
              style={{ background: COPPER }}
            >
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
