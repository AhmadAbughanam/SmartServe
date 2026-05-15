# Menu Chatbot Assistant

## Implemented State

Feature 2 is implemented as a backend-grounded customer menu chatbot.

- Canonical endpoint: `POST /api/ai/menu-chat`
- Backend service: `apps/api/src/modules/ai/menu-chatbot.service.ts`
- Shared contract: `packages/shared-types/src/menu-chat.ts`
- Audit model: `MenuChatLog`
- Frontend component: `apps/web/src/components/ai/MenuChatAssistant.tsx`
- Optional hosted LLM boundary: Hugging Face Inference Providers through NestJS
- Optional FastAPI boundary: `POST /menu-chat`

The previous MVP chatbot service/widget were consolidated. `apps/api/src/modules/ai/chatbot.service.ts` and `apps/web/src/components/chatbot-widget.tsx` were removed, and the legacy backend route `POST /api/ai/chatbot/menu` remains only as a temporary alias to the canonical service.

## Endpoint

```txt
POST /api/ai/menu-chat
```

Request body:

```json
{
  "branchId": "seed-branch-1",
  "tenantId": "optional-tenant-id",
  "userId": "optional-advisory-user-id",
  "sessionId": "optional-session-id",
  "message": "I want something spicy",
  "cartItems": [
    { "menuItemId": "seed-item-burger", "quantity": 1 }
  ]
}
```

Response body:

```json
{
  "reply": "Here are a few spicy options from the current menu.",
  "suggestedItems": [
    {
      "menuItemId": "seed-item-spicy",
      "name": "Spicy Chicken Burger",
      "reason": "Marked as spicy or described as spicy in the menu."
    }
  ],
  "safetyNotes": []
}
```

The frontend calls only the NestJS API. FastAPI is an internal optional boundary and is never called directly from `apps/web`.

## User-Facing Examples

Supported MVP examples include:

- "What do you recommend?"
- "I want something spicy"
- "What is vegetarian?"
- "Suggest something light"
- "What goes well with burger?"
- "Do you have anything without dairy?"

The assistant only suggests active and available items from the selected branch menu. It does not fabricate prices, allergens, dietary labels, ingredients, availability, or discounts.

## Architecture

Flow:

```txt
Customer menu page
  -> POST /api/ai/menu-chat
  -> MenuChatbotService
  -> Prisma scoped branch/menu/session queries
  -> local safe intent rules
  -> optional Hugging Face LLM with sanitized branch menu context
  -> optional FastAPI /menu-chat
  -> RecommendationService fallback
  -> MenuChatLog audit record
```

The Hugging Face LLM and FastAPI receive only sanitized menu context from NestJS. Neither service queries the database. NestJS filters AI output against the scoped active/available menu and ignores failed or invalid AI responses.

## Current Repo Facts

- Feature 1 recommendations are already centralized in `RecommendationService.getMenuRecommendations()`.
- The chatbot can reuse the recommendation engine for general, unknown, pairing, and empty-result fallback cases.
- `MenuItem` already supports:
  - `name`
  - `description`
  - `ingredients`
  - `price`
  - `dietaryInfo`
  - `allergensJson`
  - `isVegetarian`
  - `isSpicy`
  - `prepTimeMinutes`
  - `imageUrl`
  - `isActive`
  - `isUnavailable`
- `MenuItem` does not currently support:
  - `tags`
  - `calories`
- Existing frontend menu data already has price/image/availability fields, so suggested item cards should render from loaded menu data, not from AI response pricing.

## Safety Rules

- Only suggest real menu items from the selected branch's active and available menu.
- Tenant scope must be derived from the branch and validated against any provided `tenantId`.
- Session scope must be validated against tenant and branch before using session/customer context.
- Public request body `userId` must not be trusted as an authorization source. Prefer authenticated customer context or validated session data.
- Do not invent menu items, prices, allergens, dietary labels, ingredients, discounts, availability, or branch details.
- For allergens and strict dietary questions, answer confidently only when structured menu data supports it.
- Treat missing allergen data as unknown, not safe.
- Hugging Face/FastAPI output is advisory only. NestJS must filter invalid item IDs and fallback on invalid/failed responses.
- `HF_TOKEN` is backend-only and must never be exposed through `apps/web`, `NEXT_PUBLIC_*`, or committed env files.
- Logging must not store full customer free text unless a future explicit consent/logging policy is added.

## Phase 1: Shared Contract

Add `packages/shared-types/src/menu-chat.ts`:

```ts
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

export interface MenuChatResponse {
  reply: string;
  suggestedItems: MenuChatSuggestedItem[];
  safetyNotes?: string[];
}
```

Export it from `packages/shared-types/src/index.ts`.

Acceptance criteria:

- API and web import the same `MenuChatRequest` and `MenuChatResponse` types.
- The older frontend-only `ChatbotResponse` shape is retired or kept only as a temporary compatibility type.

Status: complete. `packages/shared-types/src/menu-chat.ts` now defines the shared menu chat request/response contracts and `packages/shared-types/src/index.ts` exports them from the package barrel. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/shared-types` passes.

## Phase 2: Backend DTOs

Create:

- `apps/api/src/modules/ai/dto/menu-chat-request.dto.ts`
- `apps/api/src/modules/ai/dto/menu-chat-response.dto.ts`

Request validation:

- `branchId`: required string
- `tenantId`: optional string
- `userId`: optional string, advisory only
- `sessionId`: optional string
- `message`: required string, min length 1, max length 500
- `cartItems`: optional array
- `cartItems[].menuItemId`: string
- `cartItems[].quantity`: integer >= 1

Acceptance criteria:

- Empty messages are rejected by validation.
- Very long messages are rejected.
- Invalid cart item quantities are rejected.

Status: complete. Added `MenuChatRequestDto` with branch/message/cart validation and `MenuChatResponseDto` implementing the shared response contract. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

## Phase 3: Audit Model

Add a dedicated `MenuChatLog` Prisma model rather than overloading `RecommendationLog`.

Preferred fields:

```prisma
model MenuChatLog {
  id               String   @id @default(cuid())
  tenantId         String
  branchId         String
  userId           String?
  sessionId        String?
  messageIntent    String?
  messageHash      String?
  messagePreview   String?
  suggestedItemIds Json
  safetyNotes      Json?
  usedAiService    Boolean  @default(false)
  usedFallback     Boolean  @default(false)
  metadata         Json?
  createdAt        DateTime @default(now())

  @@index([tenantId, branchId, createdAt])
  @@index([userId])
  @@index([sessionId])
}
```

Implementation notes:

- Add relations only if useful, and update `Tenant`, `Branch`, `User`, and `Session` relation arrays consistently if relations are declared.
- Store a short preview and hash of the message, not the full message.
- Logging failure must be caught and must not break the customer response.

Acceptance criteria:

- Chat requests are auditable.
- Full free text is not stored.
- Failed logging still returns a response.

Status: complete. Added `MenuChatLog` to Prisma with tenant, branch, optional user/session scope, message intent/hash/preview fields, suggested item IDs, safety notes, fallback/AI flags, metadata, and audit indexes. Migration `20260503073038_add_menu_chat_logs` was created and applied. Verification: `npm.cmd run prisma:validate --workspace @smart-restaurant/api`, `npm.cmd run prisma:generate --workspace @smart-restaurant/api`, and `npm.cmd run typecheck --workspace @smart-restaurant/api` pass.

## Phase 4: MenuChatbotService

Create `apps/api/src/modules/ai/menu-chatbot.service.ts`.

Responsibilities:

1. Load branch and derive `tenantId`.
2. Validate provided `tenantId` against branch tenant.
3. Validate `sessionId` belongs to the same tenant and branch.
4. Resolve effective `userId` from session/authenticated customer where available.
5. Fetch branch menu items with:
   - `tenantId`
   - `isActive: true`
   - `isUnavailable: false`
   - `OR: [{ branchId }, { branchId: null }]`
6. Exclude cart items from suggestions unless the intent clearly asks for reorder/extra.
7. Detect intent with deterministic rules.
8. Suggest only validated menu item IDs.
9. Use `RecommendationService.getMenuRecommendations()` as fallback.
10. Write `MenuChatLog` asynchronously/non-blocking.

This service should replace or absorb the existing `ChatbotService` logic. Do not leave two independent chatbot implementations with different safety behavior.

Acceptance criteria:

- No inactive/unavailable item suggestions.
- No cross-tenant or cross-branch leakage.
- Unknown branch returns a safe empty response or controlled error.
- Fallback to recommendations works.

Status: complete. Added `apps/api/src/modules/ai/menu-chatbot.service.ts` with branch-derived tenant scope, optional tenant validation, session validation, active/available branch menu loading, cart exclusion, rule-based local responses, conservative allergen handling, fallback to `RecommendationService.getMenuRecommendations()`, and non-blocking `MenuChatLog` writes. The service is not exposed through a controller yet; endpoint consolidation remains Phase 6. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

## Phase 5: Intent MVP

Supported intents:

- `GENERAL_RECOMMENDATION`
- `SPICY`
- `VEGETARIAN`
- `LIGHT`
- `PAIRING`
- `DAIRY_FREE`
- `ALLERGEN`
- `UNKNOWN`

Use current schema safely:

- `SPICY`: use `isSpicy` first, then `dietaryInfo`/description keywords only as menu-authored soft evidence.
- `VEGETARIAN`: use `isVegetarian` first, then `dietaryInfo`.
- `LIGHT`: use category/description/prep-time wording as soft matching only. Avoid health claims.
- `PAIRING`: prefer recommendation engine co-purchase/frequently-bought results using cart items or matched item.
- `DAIRY_FREE` / `ALLERGEN`: use `allergensJson` only when present. If data is missing or ambiguous, include a safety note and recommend asking staff.
- `UNKNOWN`: fallback to recommendation engine.

Standard allergen safety response:

```txt
I can't confirm that from the available menu data. Please ask the restaurant staff to be safe.
```

Acceptance criteria:

- Spicy and vegetarian queries use structured fields where available.
- Dairy/allergen queries do not fabricate safety claims.
- Unknown intent still returns recommendations when available.

Status: complete. Intent behavior is implemented in `MenuChatbotService` and hardened so allergen/dairy-free responses with missing or ambiguous allergen data do not fall through to generic recommendations. General, pairing, unknown, spicy-empty, and light-empty paths can use recommendation fallback where safe. Pairing fallback now seeds the recommendation engine with a mentioned menu item when possible, including partial item-name matches like "burger" for "Classic Burger". Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

## Phase 6: Endpoint Consolidation

Update `AiController` with:

```ts
@Public()
@Post("menu-chat")
async menuChat(@Body() dto: MenuChatRequestDto): Promise<MenuChatResponse> {
  return this.menuChatbotService.chat(dto);
}
```

Module wiring:

- Add `MenuChatbotService` to `AiModule` providers.
- Export it only if another module needs it.
- Keep `RecommendationService` reused from the existing `AiModule`.
- Either remove the old `POST /api/ai/chatbot/menu` endpoint or make it a compatibility wrapper around `menuChat()`.

Acceptance criteria:

- Canonical endpoint is `POST /api/ai/menu-chat`.
- Existing frontend is migrated to the canonical endpoint.
- No duplicate chatbot business logic remains.

Status: complete for backend endpoint consolidation. `AiController` now exposes canonical `POST /api/ai/menu-chat` using `MenuChatbotService`, and the old `POST /api/ai/chatbot/menu` route is kept only as a temporary alias that delegates to the same service. `AiModule` now provides/exports `MenuChatbotService`, and the old duplicate `ChatbotService` implementation was removed. Frontend migration remains Phase 8. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

## Phase 7: Optional FastAPI Boundary

Add FastAPI `POST /menu-chat` only after the NestJS local path is complete.

FastAPI must receive sanitized menu context from NestJS:

- item ID
- name
- menu-authored description
- structured dietary/allergen/spicy/vegetarian fields
- cart item IDs and quantities

FastAPI must not fetch database data.

NestJS must:

- set a short timeout
- ignore failures
- filter returned suggested item IDs against the scoped active/available item set
- fallback when FastAPI returns invalid/empty suggestions

Acceptance criteria:

- Frontend never calls FastAPI.
- Invalid FastAPI item IDs are dropped.
- Local fallback works when FastAPI is down.

Status: complete. Added FastAPI `POST /menu-chat` in `apps/ai-services/app/main.py` with database-free deterministic responses from sanitized NestJS-provided menu context. `MenuChatbotService` now calls `${AI_SERVICE_URL}/menu-chat` with a 1.5s timeout after computing the safe local/fallback response, skips FastAPI for allergen safety responses, filters all returned item IDs against the scoped active/available menu and cart exclusions, and keeps the local response if FastAPI fails or returns invalid/empty suggestions. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` and `python -m py_compile apps/ai-services/app/main.py` pass.

## Phase 8: Frontend Chat UI

Refactor or replace `apps/web/src/components/chatbot-widget.tsx` with:

```txt
apps/web/src/components/ai/MenuChatAssistant.tsx
```

Recommended approach:

- Keep the current customer menu page integration point.
- Move the component to the new location.
- Use shared `MenuChatResponse`.
- Call `POST /api/ai/menu-chat` through existing `post()` helper.
- Send `branchId`, `sessionId`, cart items, and optional tenant/user context only if safely available.
- Render suggested items by joining response IDs to already loaded menu items.
- Use real loaded menu item price/image/availability for cards.
- Add-to-cart uses existing cart dispatch.
- Hide suggestions that are missing, inactive, unavailable, or already invalid in loaded menu data.

UI states:

- closed floating button
- open empty state with prompt chips
- loading
- reply with suggested items
- compact error state

Acceptance criteria:

- Frontend calls only `/api/ai/menu-chat`.
- Suggested item price/image comes from loaded menu data.
- Suggested item add-to-cart reuses existing cart logic.
- Error state does not block normal menu ordering.

Status: complete for the customer menu page. Added `apps/web/src/components/ai/MenuChatAssistant.tsx`, migrated the customer menu page to the canonical `/api/ai/menu-chat` endpoint, and removed the old `chatbot-widget.tsx` plus legacy frontend `ChatbotResponse` type. The assistant renders as a floating button, supports prompt chips/loading/error/reply states, joins suggested IDs to the already loaded menu for price/image/availability, and reuses existing cart add dispatch. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/web`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, and `npm.cmd run build --workspace @smart-restaurant/web` pass. The first build attempt hit a sandbox `spawn EPERM`; rerunning with approval succeeded.

## Phase 9: Backend Tests

Add a focused Prisma-backed test script similar to `recommendation.service.phase4.test.ts`.

Required coverage:

1. Rejects empty message through DTO/validation coverage or controller-level test.
2. Returns only active and available items.
3. Does not leak another tenant's items.
4. Does not leak another branch's items.
5. Vegetarian query uses `isVegetarian`/`dietaryInfo`.
6. Spicy query uses `isSpicy`.
7. Dairy/allergen query returns safety note when allergen data is unavailable.
8. Pairing query falls back to recommendation/co-purchase logic.
9. Unknown intent falls back to `RecommendationService`.
10. FastAPI failure falls back locally if FastAPI is implemented.
11. Invalid FastAPI item IDs are filtered if FastAPI is implemented.
12. Creates `MenuChatLog`.
13. Logging failure does not break response.

Acceptance criteria:

- API typecheck passes.
- Shared types typecheck passes.
- Chatbot test script passes.

Status: complete. Added `apps/api/src/modules/ai/menu-chatbot.service.phase9.test.ts` and API script `test:menu-chatbot`. The Prisma-backed test seeds isolated tenants/branches/sessions/menu/order history and verifies DTO validation for empty/long messages and invalid cart quantities, active/available filtering, tenant/branch/session isolation, vegetarian and spicy structured matching, dairy/allergen safety behavior, pairing/recommendation fallback, FastAPI failure fallback, invalid FastAPI item ID filtering, `MenuChatLog` creation, and logging failure tolerance. Verification: `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` and `npm.cmd run typecheck --workspace @smart-restaurant/api` pass. The test command requires spawn permission for `tsx`/esbuild in this sandbox.

## Phase 10: Frontend Verification

If frontend test setup is available, cover:

1. Floating chat button renders.
2. Chat panel opens.
3. Message sends to `/api/ai/menu-chat`.
4. Loading state appears.
5. Reply appears.
6. Suggested items render from loaded menu data.
7. Add-to-cart works for suggested items.
8. Error state appears when API fails.

If no focused test setup exists, verify by:

- `npm.cmd run typecheck --workspace @smart-restaurant/web`
- `npm.cmd run build --workspace @smart-restaurant/web`
- manual customer menu flow against seeded branch/session

Status: complete. Added focused Playwright coverage in `e2e/14-menu-chat-assistant.spec.ts` using mocked `/api/menu`, `/api/recommendations/menu`, and `/api/ai/menu-chat` responses. The tests verify the floating chat button renders, the panel opens, prompt chip sends to `/api/ai/menu-chat`, loading state appears, reply appears, suggested items render using loaded menu price data, add-to-cart exposes the cart CTA, and the compact error state appears on API failure. Added stable test IDs to `MenuChatAssistant` for verification. Verification: `npm.cmd run typecheck --workspace @smart-restaurant/web`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, `npx.cmd playwright test e2e/14-menu-chat-assistant.spec.ts`, and `npm.cmd run build --workspace @smart-restaurant/web` pass. Playwright/build commands require spawn permission in this sandbox.

## Phase 11: Documentation And Memory

Update this document as each phase completes.

Update `memory.md` after meaningful implementation milestones:

- shared contract added
- backend endpoint/service/logging added
- frontend migrated
- FastAPI boundary added, if implemented
- tests passing

Status: complete. This document now includes the implemented state, endpoint request/response reference, user-facing examples, architecture flow, grounding/safety rules, phase completion notes, MVP limitations, and future upgrades. `memory.md` has checkpoint entries for planning and Phases 1-10, plus a final Phase 11 checkpoint. Final verification passed: API/web/shared typechecks, backend chatbot test, Python compile, focused Playwright test, and web production build.

## Phase 12: Hosted LLM Boundary

Status: complete. Added `apps/api/src/modules/ai/menu-chat-llm.service.ts` for optional Hugging Face Inference Providers chat completion through the OpenAI-compatible endpoint. `MenuChatbotService` still owns all Prisma reads, tenant/branch/session validation, menu context sanitization, output filtering, fallback behavior, and audit logging.

Environment variables:

```env
HF_TOKEN=hf_your_token_here
HF_MODEL=meta-llama/Llama-3.1-8B-Instruct:fastest
HF_BASE_URL=https://router.huggingface.co/v1
```

Runtime behavior:

- If `HF_TOKEN` is missing, the chatbot keeps using the local rules, recommendation fallback, and optional FastAPI path.
- If Hugging Face fails, times out, or returns invalid JSON, NestJS falls back without breaking the customer response.
- LLM suggested item IDs are filtered against the current branch's active/available menu and cart exclusions.
- The LLM may return a grounded reply without suggestions for questions such as unavailable items or unsupported claims.
- The leaked development token from chat must be revoked and replaced before use.

## MVP Limitations

- Hosted LLM behavior depends on the configured Hugging Face model/provider availability.
- Allergen answers depend on structured menu data quality.
- No conversation memory beyond the current frontend panel.
- No personalization beyond session/cart and recommendation-engine fallback.
- No multilingual Arabic/English optimization yet.
- FastAPI/LLM output is filtered and never trusted directly.

## Future Upgrades

- Provider abstraction for multiple LLM vendors with health checks and cost controls.
- Better Arabic/English multilingual matching.
- Dietary preference profiles.
- Voice ordering.
- Conversation memory per session with explicit privacy rules.
- A/B testing for prompt chips and assistant responses.
- Staff-configurable assistant tone.
- Admin workflow to certify allergen data completeness per branch.
