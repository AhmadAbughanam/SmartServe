# Testing Guide

The backend uses focused TypeScript test scripts run with `tsx` instead of a conventional test runner like Jest or Vitest.

## Running Tests

### Critical Test Suite

To run the most critical backend tests, use the following command from the root of the repository:

```bash
npm run test:critical
```

This suite covers:

-   Tenant/branch role isolation
-   Public QR order creation safety
-   Payment amount calculation and webhook safety
-   Webhook signature verification
-   Inventory transaction safety
-   DTO validation
-   AI output validation
-   And more...

### Other Focused API Tests

You can run other, more specific tests for different modules:

```bash
npm run test:recommendations --workspace @smart-restaurant/api
npm run test:menu-chatbot --workspace @smart-restaurant/api
npm run test:review-sentiment --workspace @smart-restaurant/api
# and so on...
```

### Security Audit

Run the `npm audit` gate:

```bash
npm run audit:security
```

### Production Rehearsal

Before deploying to production, run the production rehearsal script. This will validate your production environment, configuration, and TLS setup.

```bash
npm run rehearsal:production -- https://your-domain.com
```
