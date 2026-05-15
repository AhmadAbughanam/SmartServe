# Loyalty System MVP

## Purpose

Create a tenant-scoped loyalty system that rewards repeat customers after paid orders and turns points into controlled rewards on the Promotions page.

## Implemented MVP Rules

- Earn: configurable points per `1.00` paid order currency unit.
- Posting trigger: completed payment only.
- Refunds: reverse points earned for the refunded amount.
- Redemption: active rewards convert points into one-use coupons.
- Reward delivery: generated fixed-value discount + coupon.
- Expiry: configured in months on earned ledger entries.
- Manual adjustments: available through the API and written to the ledger.

## Tiers

- Bronze: `0-499` points, base earn rate.
- Silver: `500-1,999` lifetime points.
- Gold: `2,000-4,999` lifetime points.
- Platinum: `5,000+` lifetime points.

## Backend Model

- `LoyaltyProgram`: tenant settings, earn rate, default reward value, expiry, active flag.
- `LoyaltyAccount`: tenant, user, point balance, lifetime points, tier.
- `LoyaltyLedgerEntry`: earn, redeem, refund reversal, expiry, manual adjustment.
- `LoyaltyReward`: reusable reward configuration.
- `LoyaltyRewardRedemption`: reward issue history linked to generated coupons.

## Safety Rules

- All rows must be tenant scoped.
- Branch context should come from the order/payment when points are earned.
- Manual point adjustment must require staff permission and audit logging.
- Customer personal data should not be exposed in the Promotions page beyond necessary lookup metadata.
- Ledger entries are append-only for point events; balances are updated transactionally.

## Promotions Page Placement

The Promotions page includes a live Loyalty tab. It lets owners/managers:

- activate or pause point posting
- configure earn rate, default reward value, and expiry
- create, pause, and delete reward definitions
- review member count, point liability, lifetime points, and top members

## API

- `GET /api/admin/loyalty/program`
- `PATCH /api/admin/loyalty/program`
- `GET /api/admin/loyalty/rewards`
- `POST /api/admin/loyalty/rewards`
- `PATCH /api/admin/loyalty/rewards/:rewardId`
- `DELETE /api/admin/loyalty/rewards/:rewardId`
- `GET /api/admin/loyalty/members`
- `POST /api/admin/loyalty/members/:userId/adjustments`
- `POST /api/admin/loyalty/members/:userId/rewards/:rewardId/redeem`

## Current Limitations

- Customer-facing balance and reward redemption screens are not built yet.
- Point expiry is stored per earned ledger entry, but a scheduled expiry job is not implemented yet.
- Reward redemption is available as an admin/API operation; checkout application of generated coupons uses the existing coupon infrastructure.
- Advanced loyalty campaigns, tier multipliers, birthday bonuses, and branch-specific rules are future upgrades.
