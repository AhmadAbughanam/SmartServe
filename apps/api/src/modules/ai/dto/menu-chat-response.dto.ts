import type {
  MenuChatLanguage,
  MenuChatResponse,
  MenuChatStaffHelpReason,
  MenuChatSuggestedItem,
} from "@smart-restaurant/shared-types";

export class MenuChatSuggestedItemDto implements MenuChatSuggestedItem {
  menuItemId!: string;
  name!: string;
  reason!: string;
}

export class MenuChatResponseDto implements MenuChatResponse {
  reply!: string;
  suggestedItems!: MenuChatSuggestedItemDto[];
  safetyNotes?: string[];
  requiresStaffHelp?: boolean;
  staffHelpReason?: MenuChatStaffHelpReason;
  language?: MenuChatLanguage;
}
