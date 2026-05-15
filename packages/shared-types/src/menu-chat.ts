export interface MenuChatCartItemInput {
  menuItemId: string;
  quantity: number;
}

export interface MenuChatRequest {
  branchId: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  message: string;
  cartItems?: MenuChatCartItemInput[];
}

export interface MenuChatSuggestedItem {
  menuItemId: string;
  name: string;
  reason: string;
}

export type MenuChatStaffHelpReason =
  | "ALLERGEN_UNCERTAIN"
  | "INGREDIENT_UNCERTAIN"
  | "POLICY_OR_PAYMENT"
  | "CUSTOM_PREPARATION"
  | "NO_SAFE_MENU_MATCH";

export type MenuChatLanguage = "en" | "ar";

export interface MenuChatResponse {
  reply: string;
  suggestedItems: MenuChatSuggestedItem[];
  safetyNotes?: string[];
  requiresStaffHelp?: boolean;
  staffHelpReason?: MenuChatStaffHelpReason;
  language?: MenuChatLanguage;
}
