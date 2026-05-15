"use client";

import { createContext, useContext } from "react";

export interface AdminBranchContextValue {
  branchId: string;
  setBranch: (id: string) => void;
}

export const AdminBranchContext = createContext<AdminBranchContextValue>({
  branchId: "",
  setBranch: () => {},
});

export function useAdminBranch() {
  return useContext(AdminBranchContext);
}
