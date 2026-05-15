"use client";

import { createContext, useContext, useReducer, useEffect, type Dispatch } from "react";
import type { CartItem } from "./types";

interface CartState {
  items: CartItem[];
  sessionId: string | null;
  branchId: string | null;
  /* Presentation-only context — set when session starts, used for header pills. */
  branchName: string | null;
  tableCode: string | null;
  guestCount: number | null;
}

type CartAction =
  | { type: "SET_SESSION"; sessionId: string; branchId: string; branchName?: string | null; tableCode?: string | null; guestCount?: number | null }
  | { type: "SET_CONTEXT"; branchName?: string | null; tableCode?: string | null; guestCount?: number | null }
  | { type: "ADD_ITEM"; item: CartItem }
  | { type: "REMOVE_ITEM"; menuItemId: string }
  | { type: "UPDATE_QTY"; menuItemId: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "RESTORE"; state: CartState };

const STORAGE_KEY = "cart";

function persist(state: CartState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function loadPersisted(): CartState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.items)) return parsed;
  } catch {}
  return null;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  let next: CartState;
  switch (action.type) {
    case "RESTORE":
      return action.state;
    case "SET_SESSION": {
      const ctx = {
        branchName: action.branchName ?? state.branchName,
        tableCode: action.tableCode ?? state.tableCode,
        guestCount: action.guestCount ?? state.guestCount,
      };
      // Clear cart if switching to a different session to prevent cross-session leaks
      if (state.sessionId && state.sessionId !== action.sessionId) {
        next = { items: [], sessionId: action.sessionId, branchId: action.branchId, ...ctx };
      } else {
        next = { ...state, sessionId: action.sessionId, branchId: action.branchId, ...ctx };
      }
      break;
    }
    case "SET_CONTEXT":
      next = {
        ...state,
        branchName: action.branchName ?? state.branchName,
        tableCode: action.tableCode ?? state.tableCode,
        guestCount: action.guestCount ?? state.guestCount,
      };
      break;
    case "ADD_ITEM": {
      const existing = state.items.find(
        (i) =>
          i.menuItemId === action.item.menuItemId &&
          JSON.stringify(i.additions) === JSON.stringify(action.item.additions),
      );
      if (existing) {
        next = {
          ...state,
          items: state.items.map((i) =>
            i === existing ? { ...i, quantity: i.quantity + action.item.quantity } : i,
          ),
        };
      } else {
        next = { ...state, items: [...state.items, action.item] };
      }
      break;
    }
    case "REMOVE_ITEM":
      next = { ...state, items: state.items.filter((i) => i.menuItemId !== action.menuItemId) };
      break;
    case "UPDATE_QTY":
      next = {
        ...state,
        items: state.items
          .map((i) => (i.menuItemId === action.menuItemId ? { ...i, quantity: action.quantity } : i))
          .filter((i) => i.quantity > 0),
      };
      break;
    case "CLEAR":
      next = { ...state, items: [] };
      break;
    default:
      return state;
  }
  persist(next);
  return next;
}

const initial: CartState = { items: [], sessionId: null, branchId: null, branchName: null, tableCode: null, guestCount: null };

export const CartContext = createContext<{
  state: CartState;
  dispatch: Dispatch<CartAction>;
}>({ state: initial, dispatch: () => {} });

export function useCart() {
  return useContext(CartContext);
}

export function useCartReducer(): [CartState, Dispatch<CartAction>] {
  const [state, dispatch] = useReducer(cartReducer, initial);

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = loadPersisted();
    if (saved && saved.items.length > 0) {
      dispatch({ type: "RESTORE", state: saved });
    }
  }, []);

  return [state, dispatch];
}

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => {
    const additionsTotal = i.additions.reduce((s, a) => s + a.priceImpact, 0);
    return sum + (i.price + additionsTotal) * i.quantity;
  }, 0);
}
