"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { CartContext, useCartReducer } from "./cart-store";
import { ToastProvider } from "../components/ui";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  const [state, dispatch] = useCartReducer();

  return (
    <QueryClientProvider client={queryClient}>
      <CartContext.Provider value={{ state, dispatch }}>
        <ToastProvider>{children}</ToastProvider>
      </CartContext.Provider>
    </QueryClientProvider>
  );
}
