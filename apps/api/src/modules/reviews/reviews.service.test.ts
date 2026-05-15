import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ReviewsService } from "./reviews.service.js";

function createMockPrisma(order: {
  id: string;
  sessionId: string;
  tenantId: string;
  branchId: string;
  orderStatus: string;
  paymentStatus: string;
  orderItems: Array<{ menuItemId: string }>;
}) {
  const createdReviews: unknown[] = [];

  return {
    createdReviews,
    order: {
      findFirst: async () => order,
    },
    review: {
      findFirst: async () => null,
      create: async (args: unknown) => {
        createdReviews.push(args);
        return args;
      },
    },
  };
}

async function assertRejectsBadRequest(action: () => Promise<unknown>, message: string) {
  try {
    await action();
    assert.fail(message);
  } catch (error) {
    assert.ok(error instanceof BadRequestException, message);
  }
}

async function run() {
  const baseOrder = {
    id: "order-1",
    sessionId: "session-1",
    tenantId: "tenant-1",
    branchId: "branch-1",
    orderStatus: "PLACED",
    paymentStatus: "UNPAID",
    orderItems: [{ menuItemId: "item-1" }],
  };

  const unpaidPrisma = createMockPrisma(baseOrder);
  const unpaidService = new ReviewsService(unpaidPrisma as never);

  await assertRejectsBadRequest(
    () => unpaidService.createReview("order-1", "session-1", { overallRating: 5 }),
    "unpaid, unserved orders should not be reviewable",
  );

  const paidBeforeServicePrisma = createMockPrisma({ ...baseOrder, paymentStatus: "PAID" });
  const paidBeforeService = new ReviewsService(paidBeforeServicePrisma as never);

  await assertRejectsBadRequest(
    () => paidBeforeService.createReview("order-1", "session-1", { overallRating: 5 }),
    "paid orders should not be reviewable before service",
  );

  const servedPrisma = createMockPrisma({ ...baseOrder, orderStatus: "SERVED", paymentStatus: "UNPAID" });
  const servedService = new ReviewsService(servedPrisma as never);

  await servedService.createReview("order-1", "session-1", {
    overallRating: 4,
    issueTags: ["LATE"],
    itemReviews: [{ menuItemId: "item-1", rating: 3 }],
  });

  assert.equal(servedPrisma.createdReviews.length, 1);
  assert.deepEqual(servedPrisma.createdReviews[0], {
    data: {
      tenantId: "tenant-1",
      branchId: "branch-1",
      orderId: "order-1",
      overallRating: 4,
      comment: undefined,
      issueTags: { create: [{ tag: "LATE" }] },
      itemReviews: { create: [{ menuItemId: "item-1", rating: 3, comment: undefined }] },
    },
    include: { issueTags: true, itemReviews: true },
  });

  await assertRejectsBadRequest(
    () => servedService.createReview("order-1", "session-1", {
      overallRating: 4,
      itemReviews: [{ menuItemId: "other-item", rating: 3 }],
    }),
    "item reviews should only reference items from the order",
  );
}

run()
  .then(() => {
    console.log("ReviewsService post-service review tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
