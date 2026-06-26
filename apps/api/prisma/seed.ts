import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();


type WeightedEntry<T> = {
  item: T;
  weight: number;
};

type BasketLine = {
  item: any;
  quantity: number;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(items: T[]): T {
  if (!items.length) throw new Error("randomFrom received an empty array.");
  return items[Math.floor(Math.random() * items.length)];
}

function weightedRandom<T>(items: WeightedEntry<T>[]): T {
  if (!items.length) throw new Error("weightedRandom received an empty array.");

  const totalWeight = items.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const entry of items) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }

  return items[items.length - 1].item;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function minutesAfter(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function makeDateDaysAgoAt(daysBack: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  date.setHours(hour, randomInt(0, 59), randomInt(0, 59), 0);
  return date;
}

function getOrdersForHour(hour: number, dayOfWeek: number): number {
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday / Saturday in Jordan restaurant rhythm
  let baseMin = 0;
  let baseMax = 0;

  if (hour >= 8 && hour <= 11) {
    baseMin = 0;
    baseMax = 1;
  } else if (hour >= 12 && hour <= 15) {
    baseMin = 2;
    baseMax = 4;
  } else if (hour >= 16 && hour <= 18) {
    baseMin = 0;
    baseMax = 2;
  } else if (hour >= 19 && hour <= 23) {
    baseMin = 3;
    baseMax = 6;
  }

  const base = randomInt(baseMin, baseMax);
  return isWeekend ? Math.round(base * 1.45) : base;
}

function findMenuItem(menuItems: any[], name: string) {
  const item = menuItems.find((entry) => entry.name === name);
  if (!item) throw new Error(`Missing seeded menu item: ${name}`);
  return item;
}

function buildLogicalBasket(menuItems: any[]): BasketLine[] {
  const main = weightedRandom([
    { item: findMenuItem(menuItems, "Classic Burger"), weight: 28 },
    { item: findMenuItem(menuItems, "Double Cheese Burger"), weight: 16 },
    { item: findMenuItem(menuItems, "Chicken Burger"), weight: 14 },
    { item: findMenuItem(menuItems, "Spaghetti Carbonara"), weight: 16 },
    { item: findMenuItem(menuItems, "Alfredo Pasta"), weight: 12 },
    { item: findMenuItem(menuItems, "Grilled Chicken Meal"), weight: 14 },
  ]);

  const basket: BasketLine[] = [{ item: main, quantity: 1 }];

  // Starters: common with main meals, but not guaranteed.
  if (Math.random() < 0.28) {
    basket.push({
      item: weightedRandom([
        { item: findMenuItem(menuItems, "Bruschetta"), weight: 30 },
        { item: findMenuItem(menuItems, "French Fries"), weight: 45 },
        { item: findMenuItem(menuItems, "Chicken Wings"), weight: 25 },
      ]),
      quantity: 1,
    });
  }

  // Drinks: high attach rate, especially for burgers and chicken.
  const drinkAttachRate = main.name.includes("Burger") || main.name.includes("Chicken") ? 0.82 : 0.68;
  if (Math.random() < drinkAttachRate) {
    basket.push({
      item: weightedRandom([
        { item: findMenuItem(menuItems, "Cola"), weight: 48 },
        { item: findMenuItem(menuItems, "Fresh Orange Juice"), weight: 24 },
        { item: findMenuItem(menuItems, "Iced Tea"), weight: 18 },
        { item: findMenuItem(menuItems, "Water"), weight: 10 },
      ]),
      quantity: randomInt(1, 2),
    });
  }

  // Dessert: more likely after dinner-sized meals.
  if (Math.random() < 0.18) {
    basket.push({
      item: weightedRandom([
        { item: findMenuItem(menuItems, "Cheesecake"), weight: 55 },
        { item: findMenuItem(menuItems, "Chocolate Cake"), weight: 45 },
      ]),
      quantity: 1,
    });
  }

  return basket;
}

function calculateTotals(basket: BasketLine[]) {
  const subtotal = basket.reduce(
    (sum, line) => sum + Number(line.item.price) * line.quantity,
    0,
  );

  const tax = basket.reduce((sum, line) => {
    const taxRate = line.item.taxClass === "BEVERAGE" ? 0.1 : 0.05;
    return sum + Number(line.item.price) * line.quantity * taxRate;
  }, 0);

  const discount = Math.random() < 0.08 ? subtotal * 0.1 : 0;
  const serviceCharge = 0;

  return {
    subtotalAmount: roundMoney(subtotal),
    taxAmount: roundMoney(tax),
    serviceChargeAmount: roundMoney(serviceCharge),
    discountAmount: roundMoney(discount),
    totalAmount: roundMoney(subtotal + tax + serviceCharge - discount),
  };
}

function getLogicalStatuses(orderTime: Date) {
  const ageMinutes = (Date.now() - orderTime.getTime()) / 1000 / 60;

  // Tiny cancellation rate, mostly for non-historic noise.
  if (Math.random() < 0.025 && ageMinutes > 120) {
    return {
      orderStatus: "CANCELLED",
      paymentStatus: "UNPAID",
      kitchenStatus: "CANCELLED",
      sessionStatus: "CANCELLED",
    };
  }

  if (ageMinutes > 240) {
    return {
      orderStatus: "COMPLETED",
      paymentStatus: "PAID",
      kitchenStatus: "READY",
      sessionStatus: "COMPLETED",
    };
  }

  if (ageMinutes > 75) {
    return {
      orderStatus: "SERVED",
      paymentStatus: "UNPAID",
      kitchenStatus: "READY",
      sessionStatus: "ACTIVE",
    };
  }

  if (ageMinutes > 45) {
    return {
      orderStatus: "READY",
      paymentStatus: "UNPAID",
      kitchenStatus: "READY",
      sessionStatus: "ACTIVE",
    };
  }

  if (ageMinutes > 18) {
    return {
      orderStatus: "PREPARING",
      paymentStatus: "UNPAID",
      kitchenStatus: "IN_PROGRESS",
      sessionStatus: "ACTIVE",
    };
  }

  return {
    orderStatus: "PENDING",
    paymentStatus: "UNPAID",
    kitchenStatus: "QUEUED",
    sessionStatus: "ACTIVE",
  };
}

function chooseOrderSource() {
  return weightedRandom([
    { item: "USER_APP", weight: 44 },
    { item: "WAITER_APP", weight: 36 },
    { item: "POS", weight: 20 },
  ]);
}

function choosePaymentMethod() {
  return weightedRandom([
    { item: "CARD", weight: 64 },
    { item: "CASH", weight: 31 },
    { item: "WALLET", weight: 5 },
  ]);
}

function reviewProfileForBasket(basket: BasketLine[], orderTime: Date) {
  const hour = orderTime.getHours();
  const hasPasta = basket.some((line) => line.item.name.includes("Pasta") || line.item.name.includes("Carbonara"));
  const isDinnerRush = hour >= 19 && hour <= 22;

  let negativePressure = 0;
  if (hasPasta) negativePressure += 0.1; // pasta cools faster; useful for sentiment story
  if (isDinnerRush) negativePressure += 0.08; // late complaints rise in rush hour

  const rating = weightedRandom([
    { item: 5, weight: 42 - negativePressure * 50 },
    { item: 4, weight: 31 },
    { item: 3, weight: 16 + negativePressure * 25 },
    { item: 2, weight: 8 + negativePressure * 20 },
    { item: 1, weight: 3 + negativePressure * 5 },
  ]);

  const issueTags =
    rating >= 4
      ? []
      : weightedRandom([
          { item: ["LATE"], weight: isDinnerRush ? 48 : 32 },
          { item: ["COLD"], weight: hasPasta ? 44 : 28 },
          { item: ["WRONG_ITEM"], weight: 14 },
          { item: ["LATE", "COLD"], weight: 18 },
        ]);

  return { rating, issueTags };
}

async function maybeCreateReview(params: {
  tenantId: string;
  branchId: string;
  orderId: string;
  basket: BasketLine[];
  orderTime: Date;
}) {
  const { tenantId, branchId, orderId, basket, orderTime } = params;

  // Only some completed customers review; enough for sentiment analytics, not unrealistically all orders.
  if (Math.random() > 0.34) return;

  const { rating, issueTags } = reviewProfileForBasket(basket, orderTime);

  await prisma.review.create({
    data: {
      tenantId,
      branchId,
      orderId,
      overallRating: rating,
      comment:
        rating >= 4
          ? "Great experience, fresh food, and smooth service."
          : "The experience could be improved, especially around speed and food temperature.",
      createdAt: minutesAfter(orderTime, randomInt(45, 24 * 60)),
      issueTags: {
        create: issueTags.map((tag) => ({ tag })),
      },
      itemReviews: {
        create: basket.map((line) => ({
          menuItemId: line.item.id,
          rating: Math.max(1, Math.min(5, rating + randomInt(-1, 1))),
          comment: rating >= 4 ? "Good item." : "Needs improvement.",
        })),
      },
    },
  });
}

async function seedLogicalAnalyticsData(params: {
  tenantId: string;
  branchId: string;
  days: number;
}) {
  const { tenantId, branchId, days } = params;
  console.log(`  Seeding logical analytics simulator for ${days} days...`);

  const tables = (await prisma.table.findMany({ where: { branchId } })) as any[];
  const menuItems = (await prisma.menuItem.findMany({ where: { tenantId } })) as any[];

  if (!tables.length) throw new Error("Cannot seed analytics without tables.");
  if (menuItems.length < 10) throw new Error("Cannot seed analytics without a richer menu.");

  let createdOrders = 0;
  let createdReviews = 0;

  for (let daysBack = days - 1; daysBack >= 0; daysBack--) {
    for (let hour = 8; hour <= 23; hour++) {
      const sampleTime = makeDateDaysAgoAt(daysBack, hour);
      const orderCount = getOrdersForHour(hour, sampleTime.getDay());

      for (let i = 0; i < orderCount; i++) {
        const orderTime = makeDateDaysAgoAt(daysBack, hour);
        const basket = buildLogicalBasket(menuItems);
        const totals = calculateTotals(basket);
        const statuses = getLogicalStatuses(orderTime);
        const table = randomFrom(tables);

        const session = await prisma.session.create({
          data: {
            tenantId,
            branchId,
            tableId: table.id,
            status: statuses.sessionStatus as any,
            guestCount: Math.max(1, Math.min(8, basket.length + randomInt(0, 3))),
            startTime: orderTime,
            endTime:
              statuses.sessionStatus === "COMPLETED"
                ? minutesAfter(orderTime, randomInt(35, 95))
                : null,
          },
        });

        const order = await prisma.order.create({
          data: {
            tenantId,
            branchId,
            sessionId: session.id,
            orderDateTime: orderTime,
            orderStatus: statuses.orderStatus as any,
            paymentStatus: statuses.paymentStatus as any,
            source: chooseOrderSource() as any,
            subtotalAmount: totals.subtotalAmount,
            taxAmount: totals.taxAmount,
            serviceChargeAmount: totals.serviceChargeAmount,
            discountAmount: totals.discountAmount,
            totalAmount: totals.totalAmount,
            orderItems: {
              create: basket.map((line) => {
                const taxRate = line.item.taxClass === "BEVERAGE" ? 0.1 : 0.05;
                const base = Number(line.item.price) * line.quantity;
                const lineTax = base * taxRate;
                return {
                  tenantId,
                  branchId,
                  menuItemId: line.item.id,
                  quantity: line.quantity,
                  itemBasePrice: line.item.price,
                  lineDiscountAmount: 0,
                  lineTaxAmount: roundMoney(lineTax),
                  lineTotal: roundMoney(base + lineTax),
                  kitchenStatus: statuses.kitchenStatus as any,
                };
              }),
            },
            statusHistory: {
              create: {
                tenantId,
                branchId,
                toStatus: statuses.orderStatus as any,
                changedAt: orderTime,
              },
            },
            payments:
              statuses.paymentStatus === "PAID"
                ? {
                    create: {
                      tenantId,
                      branchId,
                      sessionId: session.id,
                      amount: totals.totalAmount,
                      paymentMethod: choosePaymentMethod() as any,
                      paymentStatus: "COMPLETED" as any,
                      paymentDate: minutesAfter(orderTime, randomInt(28, 100)),
                      payerType: "CUSTOMER" as any,
                    },
                  }
                : undefined,
          },
        });

        createdOrders++;

        const reviewsBefore = await prisma.review.count({ where: { orderId: order.id } });
        if (statuses.orderStatus === "COMPLETED") {
          await maybeCreateReview({ tenantId, branchId, orderId: order.id, basket, orderTime });
        }
        const reviewsAfter = await prisma.review.count({ where: { orderId: order.id } });
        createdReviews += reviewsAfter - reviewsBefore;
      }
    }
  }

  // Final inventory snapshot tells a clear analytics story: top sellers are low, slow movers are healthy.
  await prisma.inventoryItem.updateMany({
    where: { branchId, name: { in: ["Beef Patty", "Burger Buns", "Cola Cans"] } },
    data: { currentStock: 8 },
  });
  await prisma.inventoryItem.updateMany({
    where: { branchId, name: { in: ["Spaghetti Pasta"] } },
    data: { currentStock: 4 },
  });

  console.log(`  Logical orders created: ${createdOrders}`);
  console.log(`  Logical reviews created: ${createdReviews}`);
}

async function clearDemoSeedData() {
  console.log("Clearing old demo seed data...");

  const cleanupSteps = [
    () => prisma.itemReview.deleteMany(),
    () => prisma.reviewIssueTag.deleteMany(),
    () => prisma.review.deleteMany(),

    () => prisma.payment.deleteMany(),
    () => prisma.orderStatusHistory.deleteMany(),
    () => prisma.orderItem.deleteMany(),
    () => prisma.order.deleteMany(),

    () => prisma.session.deleteMany(),

    () => prisma.tableAccessTag.deleteMany(),
    () => prisma.branchDevice.deleteMany(),
    () => prisma.branchSettings.deleteMany(),

    () => prisma.menuItemInventoryMap.deleteMany(),
    () => prisma.inventoryItem.deleteMany(),
    () => prisma.menuItemAddition.deleteMany(),
    () => prisma.menuItem.deleteMany(),
    () => prisma.category.deleteMany(),

    () => prisma.taxRule.deleteMany(),
    () => prisma.table.deleteMany(),

    () => prisma.staffRoleAssignment.deleteMany(),
    () => prisma.staff.deleteMany(),
    () => prisma.rolePermission.deleteMany(),
    () => prisma.role.deleteMany(),

    () => prisma.branch.deleteMany(),
    () => prisma.tenant.deleteMany(),
  ];

  for (const step of cleanupSteps) {
    await step().catch(() => undefined);
  }

  console.log("Old demo seed data cleared.");
}

async function main() {
  console.log("Seeding database...");
  await clearDemoSeedData();
  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "seed-tenant-1" },
    update: {},
    create: {
      id: "seed-tenant-1",
      name: "Demo Restaurant Group",
      ownerName: "Admin",
      ownerEmail: "admin@demo.com",
    },
  });
  console.log("  Tenant:", tenant.id);

  // 2. Branch
  const branch = await prisma.branch.upsert({
    where: { id: "seed-branch-1" },
    update: {},
    create: {
      id: "seed-branch-1",
      tenantId: tenant.id,
      name: "Downtown Branch",
      location: "123 Main Street",
    },
  });
  console.log("  Branch:", branch.id);

  // 2b. Second branch (for multi-branch demo)
  const branch2 = await prisma.branch.upsert({
    where: { id: "seed-branch-2" },
    update: {},
    create: {
      id: "seed-branch-2",
      tenantId: tenant.id,
      name: "Waterfront Branch",
      location: "45 Harbor Drive",
    },
  });
  console.log("  Branch 2:", branch2.id);

  // 3. Permissions
  const permissionCodes = [
    "menu:read",
    "menu:write",
    "orders:read",
    "orders:write",
    "staff:read",
    "staff:write",
    "analytics:read",
    "settings:write",
    "tables:read",
    "tables:write",
    "sessions:read",
    "sessions:write",
    "kds:read",
    "kds:write",
    "payments:read",
    "payments:write",
    "payments:refund",
    "shifts:read",
    "shifts:write",
    "tills:read",
    "tills:write",
    "pos:read",
    "pos:write",
    "attendance:write",
    "service-requests:read",
    "service-requests:claim",
    "service-requests:complete",
    "admin:read",
    "admin:write",
    "audit:read",
    "inventory:read",
    "inventory:write",
    "inventory:adjust",
    "promotions:read",
    "promotions:write",
    "coupons:read",
    "coupons:write",
    "gift-cards:read",
    "gift-cards:write",
    "gift-cards:redeem",
    "ai:read",
  ];

  for (const code of permissionCodes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, description: code },
    });
  }
  console.log("  Permissions:", permissionCodes.length);

  // 4. Owner role with all permissions
  const ownerRole = await prisma.role.upsert({
    where: { tenantId_roleName: { tenantId: tenant.id, roleName: "Owner" } },
    update: {},
    create: {
      tenantId: tenant.id,
      roleName: "Owner",
    },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: ownerRole.id, permissionId: perm.id },
    });
  }
  console.log("  Owner role with", allPermissions.length, "permissions");

  // 5. Waiter role with relevant permissions
  const waiterRole = await prisma.role.upsert({
    where: {
      tenantId_roleName: { tenantId: tenant.id, roleName: "Waiter" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      roleName: "Waiter",
    },
  });

  const waiterPermCodes = [
    "menu:read",
    "orders:read",
    "orders:write",
    "tables:read",
    "tables:write",
    "sessions:read",
    "sessions:write",
    "kds:read",
    "payments:read",
    "payments:write",
    "attendance:write",
    "service-requests:read",
    "service-requests:claim",
    "service-requests:complete",
  ];
  const waiterPerms = await prisma.permission.findMany({
    where: { code: { in: waiterPermCodes } },
  });
  for (const perm of waiterPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: waiterRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: waiterRole.id, permissionId: perm.id },
    });
  }
  console.log("  Waiter role with", waiterPerms.length, "permissions");

  // 5b. Chef role
  const chefRole = await prisma.role.upsert({
    where: {
      tenantId_roleName: { tenantId: tenant.id, roleName: "Chef" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      roleName: "Chef",
    },
  });

  const chefPermCodes = [
    "menu:read",
    "orders:read",
    "kds:read",
    "kds:write",
  ];
  const chefPerms = await prisma.permission.findMany({
    where: { code: { in: chefPermCodes } },
  });
  for (const perm of chefPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: chefRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: chefRole.id, permissionId: perm.id },
    });
  }
  console.log("  Chef role with", chefPerms.length, "permissions");

  // 5c. Cashier role
  const cashierRole = await prisma.role.upsert({
    where: {
      tenantId_roleName: { tenantId: tenant.id, roleName: "Cashier" },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      roleName: "Cashier",
    },
  });

  const cashierPermCodes = [
    "menu:read",
    "orders:read",
    "orders:write",
    "tables:read",
    "sessions:read",
    "sessions:write",
    "payments:read",
    "payments:write",
    "shifts:read",
    "shifts:write",
    "tills:read",
    "tills:write",
    "pos:read",
    "pos:write",
    "inventory:read",
    "inventory:write",
    "inventory:adjust",
    "attendance:write",
    "coupons:read",
    "gift-cards:read",
    "gift-cards:redeem",
  ];
  const cashierPerms = await prisma.permission.findMany({
    where: { code: { in: cashierPermCodes } },
  });
  for (const perm of cashierPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: cashierRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: cashierRole.id, permissionId: perm.id },
    });
  }
  console.log("  Cashier role with", cashierPerms.length, "permissions");

  // 6. Staff accounts
  const passwordHash = await bcrypt.hash("password123", 10);

  const saasOwner = await prisma.user.upsert({
    where: { id: "seed-user-saas-owner" },
    update: {
      passwordHash,
      globalRole: "SAAS_OWNER",
      email: "saas@demo.com",
      phone: "+1000000999",
      name: "SaaS Owner",
    },
    create: {
      id: "seed-user-saas-owner",
      name: "SaaS Owner",
      phone: "+1000000999",
      email: "saas@demo.com",
      passwordHash,
      globalRole: "SAAS_OWNER",
    },
  });
  console.log("  SaaS owner:", saasOwner.email, "(password: password123)");

  const owner = await prisma.staff.upsert({
    where: { id: "seed-staff-owner" },
    update: { passwordHash },
    create: {
      id: "seed-staff-owner",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Owner Admin",
      phone: "+1000000001",
      email: "owner@demo.com",
      primaryRole: "OWNER",
      passwordHash,
    },
  });

  await prisma.staffRoleAssignment.upsert({
    where: {
      staffId_roleId: { staffId: owner.id, roleId: ownerRole.id },
    },
    update: {},
    create: { staffId: owner.id, roleId: ownerRole.id },
  });
  console.log("  Staff owner:", owner.email, "(password: password123)");

  const waiter = await prisma.staff.upsert({
    where: { id: "seed-staff-waiter" },
    update: { passwordHash },
    create: {
      id: "seed-staff-waiter",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Test Waiter",
      phone: "+1000000002",
      email: "waiter@demo.com",
      primaryRole: "WAITER",
      passwordHash,
    },
  });

  await prisma.staffRoleAssignment.upsert({
    where: {
      staffId_roleId: { staffId: waiter.id, roleId: waiterRole.id },
    },
    update: {},
    create: { staffId: waiter.id, roleId: waiterRole.id },
  });
  console.log("  Staff waiter:", waiter.email, "(password: password123)");

  const chef = await prisma.staff.upsert({
    where: { id: "seed-staff-chef" },
    update: { passwordHash },
    create: {
      id: "seed-staff-chef",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Test Chef",
      phone: "+1000000003",
      email: "chef@demo.com",
      primaryRole: "CHEF",
      passwordHash,
    },
  });

  await prisma.staffRoleAssignment.upsert({
    where: {
      staffId_roleId: { staffId: chef.id, roleId: chefRole.id },
    },
    update: {},
    create: { staffId: chef.id, roleId: chefRole.id },
  });
  console.log("  Staff chef:", chef.email, "(password: password123)");

  const cashier = await prisma.staff.upsert({
    where: { id: "seed-staff-cashier" },
    update: { passwordHash },
    create: {
      id: "seed-staff-cashier",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Test Cashier",
      phone: "+1000000004",
      email: "cashier@demo.com",
      primaryRole: "CASHIER",
      passwordHash,
    },
  });

  await prisma.staffRoleAssignment.upsert({
    where: {
      staffId_roleId: { staffId: cashier.id, roleId: cashierRole.id },
    },
    update: {},
    create: { staffId: cashier.id, roleId: cashierRole.id },
  });
  console.log("  Staff cashier:", cashier.email, "(password: password123)");

  // 7. Tables
  const tableDefs = [
    ...Array.from({ length: 12 }, (_, i) => ({
      code: `T${i + 1}`,
      capacity: i % 5 === 0 ? 6 : i % 3 === 0 ? 2 : 4,
      zone: i <= 6 ? "Main" : "Patio",
      location: i <= 6 ? undefined as string | undefined : "Patio",
    })),
    { code: "VIP1", capacity: 8, zone: "Private", location: "Private room" },
    { code: "VIP2", capacity: 10, zone: "Private", location: "Private room" },
  ];

  for (const t of tableDefs) {
    await prisma.table.upsert({
      where: {
        branchId_tableCode: { branchId: branch.id, tableCode: t.code },
      },
      update: { zone: t.zone, capacity: t.capacity, locationDescription: t.location },
      create: {
        branchId: branch.id,
        tableCode: t.code,
        capacity: t.capacity,
        locationDescription: t.location,
        zone: t.zone,
      },
    });
  }
  console.log("  Tables:", tableDefs.length);

  // 8. Tax rules
  const taxDefs = [
    { taxClass: "FOOD" as const, ratePercent: 5 },
    { taxClass: "BEVERAGE" as const, ratePercent: 10 },
  ];
  for (const t of taxDefs) {
    const existing = await prisma.taxRule.findFirst({
      where: { branchId: branch.id, taxClass: t.taxClass, isActive: true },
    });
    if (!existing) {
      await prisma.taxRule.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          taxClass: t.taxClass,
          ratePercent: t.ratePercent,
        },
      });
    }
  }
  console.log("  Tax rules:", taxDefs.length);

  // 9. Categories
  const catStarters = await prisma.category.upsert({
    where: { id: "seed-cat-starters" },
    update: {},
    create: {
      id: "seed-cat-starters",
      tenantId: tenant.id,
      name: "Starters",
      displayOrder: 1,
    },
  });

  const catMains = await prisma.category.upsert({
    where: { id: "seed-cat-mains" },
    update: {},
    create: {
      id: "seed-cat-mains",
      tenantId: tenant.id,
      name: "Main Courses",
      displayOrder: 2,
    },
  });

  const catDrinks = await prisma.category.upsert({
    where: { id: "seed-cat-drinks" },
    update: {},
    create: {
      id: "seed-cat-drinks",
      tenantId: tenant.id,
      name: "Drinks",
      displayOrder: 3,
    },
  });

  const catDesserts = await prisma.category.upsert({
    where: { id: "seed-cat-desserts" },
    update: {},
    create: {
      id: "seed-cat-desserts",
      tenantId: tenant.id,
      name: "Desserts",
      displayOrder: 4,
    },
  });
  console.log("  Categories: 4");

  // 10. Menu items with additions
  const itemBruschetta = await prisma.menuItem.upsert({
    where: { id: "seed-item-bruschetta" },
    update: { isVegetarian: true, dietaryInfo: "Vegetarian" },
    create: {
      id: "seed-item-bruschetta",
      tenantId: tenant.id,
      categoryId: catStarters.id,
      name: "Bruschetta",
      description: "Toasted bread with fresh tomatoes and basil",
      price: 8.5,
      dietaryInfo: "Vegetarian",
      isVegetarian: true,
      prepTimeMinutes: 10,
      taxClass: "FOOD",
    },
  });

  const itemBurger = await prisma.menuItem.upsert({
    where: { id: "seed-item-burger" },
    update: {},
    create: {
      id: "seed-item-burger",
      tenantId: tenant.id,
      categoryId: catMains.id,
      name: "Classic Burger",
      description: "Beef patty with lettuce, tomato, and special sauce",
      price: 14.0,
      prepTimeMinutes: 15,
      taxClass: "FOOD",
    },
  });

  const itemPasta = await prisma.menuItem.upsert({
    where: { id: "seed-item-pasta" },
    update: {},
    create: {
      id: "seed-item-pasta",
      tenantId: tenant.id,
      categoryId: catMains.id,
      name: "Spaghetti Carbonara",
      description: "Classic Italian pasta with egg, cheese, and pancetta",
      price: 12.0,
      prepTimeMinutes: 12,
      taxClass: "FOOD",
    },
  });

  const itemCola = await prisma.menuItem.upsert({
    where: { id: "seed-item-cola" },
    update: {},
    create: {
      id: "seed-item-cola",
      tenantId: tenant.id,
      categoryId: catDrinks.id,
      name: "Cola",
      description: "Chilled cola drink",
      price: 3.0,
      taxClass: "BEVERAGE",
    },
  });

  const itemJuice = await prisma.menuItem.upsert({
    where: { id: "seed-item-juice" },
    update: {},
    create: {
      id: "seed-item-juice",
      tenantId: tenant.id,
      categoryId: catDrinks.id,
      name: "Fresh Orange Juice",
      description: "Freshly squeezed orange juice",
      price: 5.0,
      taxClass: "BEVERAGE",
    },
  });

  const extraMenuSeeds = [
    { id: "seed-item-fries", categoryId: catStarters.id, name: "French Fries", description: "Crispy golden fries", price: 4.0, prepTimeMinutes: 8, taxClass: "FOOD" as const },
    { id: "seed-item-wings", categoryId: catStarters.id, name: "Chicken Wings", description: "Spicy glazed chicken wings", price: 7.5, prepTimeMinutes: 14, taxClass: "FOOD" as const },
    { id: "seed-item-double-burger", categoryId: catMains.id, name: "Double Cheese Burger", description: "Double beef patty with cheddar cheese", price: 17.0, prepTimeMinutes: 18, taxClass: "FOOD" as const },
    { id: "seed-item-chicken-burger", categoryId: catMains.id, name: "Chicken Burger", description: "Crispy chicken burger with garlic sauce", price: 12.5, prepTimeMinutes: 14, taxClass: "FOOD" as const },
    { id: "seed-item-alfredo", categoryId: catMains.id, name: "Alfredo Pasta", description: "Creamy alfredo pasta with parmesan", price: 13.0, prepTimeMinutes: 13, taxClass: "FOOD" as const },
    { id: "seed-item-grilled-chicken", categoryId: catMains.id, name: "Grilled Chicken Meal", description: "Grilled chicken with rice and vegetables", price: 15.5, prepTimeMinutes: 20, taxClass: "FOOD" as const },
    { id: "seed-item-iced-tea", categoryId: catDrinks.id, name: "Iced Tea", description: "Cold lemon iced tea", price: 3.5, prepTimeMinutes: 3, taxClass: "BEVERAGE" as const },
    { id: "seed-item-water", categoryId: catDrinks.id, name: "Water", description: "Still bottled water", price: 1.25, prepTimeMinutes: 1, taxClass: "BEVERAGE" as const },
    { id: "seed-item-cheesecake", categoryId: catDesserts.id, name: "Cheesecake", description: "Classic vanilla cheesecake", price: 5.5, prepTimeMinutes: 5, taxClass: "FOOD" as const },
    { id: "seed-item-chocolate-cake", categoryId: catDesserts.id, name: "Chocolate Cake", description: "Rich chocolate layer cake", price: 5.0, prepTimeMinutes: 5, taxClass: "FOOD" as const },
  ];

  for (const item of extraMenuSeeds) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        prepTimeMinutes: item.prepTimeMinutes,
        taxClass: item.taxClass,
      },
      create: {
        id: item.id,
        tenantId: tenant.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: item.price,
        prepTimeMinutes: item.prepTimeMinutes,
        taxClass: item.taxClass,
      },
    });
  }
  console.log("  Menu items:", 5 + extraMenuSeeds.length);

  // 11. Additions / modifiers
  const additionDefs = [
    {
      id: "seed-add-cheese",
      menuItemId: itemBurger.id,
      name: "Extra Cheese",
      priceImpact: 1.5,
    },
    {
      id: "seed-add-bacon",
      menuItemId: itemBurger.id,
      name: "Bacon",
      priceImpact: 2.0,
    },
    {
      id: "seed-add-mushrooms",
      menuItemId: itemPasta.id,
      name: "Add Mushrooms",
      priceImpact: 1.0,
    },
  ];

  for (const a of additionDefs) {
    await prisma.menuItemAddition.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id,
        menuItemId: a.menuItemId,
        name: a.name,
        priceImpact: a.priceImpact,
      },
    });
  }
  console.log("  Additions:", additionDefs.length);

  // 12. Inventory items
  const invBeef = await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-beef" },
    update: { category: "MEAT" },
    create: {
      id: "seed-inv-beef",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Beef Patty",
      category: "MEAT",
      unit: "pcs",
      currentStock: 50,
      reorderLevel: 10,
    },
  });

  const invBuns = await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-buns" },
    update: { category: "GRAINS" },
    create: {
      id: "seed-inv-buns",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Burger Buns",
      category: "GRAINS",
      unit: "pcs",
      currentStock: 40,
      reorderLevel: 10,
    },
  });

  const invPasta = await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-pasta" },
    update: { category: "GRAINS" },
    create: {
      id: "seed-inv-pasta",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Spaghetti Pasta",
      category: "GRAINS",
      unit: "kg",
      currentStock: 15,
      reorderLevel: 3,
    },
  });

  const invCola = await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-cola" },
    update: { category: "BEVERAGES" },
    create: {
      id: "seed-inv-cola",
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Cola Cans",
      category: "BEVERAGES",
      unit: "pcs",
      currentStock: 100,
      reorderLevel: 20,
    },
  });
  console.log("  Inventory items: 4");

  // 13. Menu-inventory mappings
  const mappings = [
    { menuItemId: itemBurger.id, inventoryItemId: invBeef.id, qtyPerItem: 1 },
    { menuItemId: itemBurger.id, inventoryItemId: invBuns.id, qtyPerItem: 1 },
    { menuItemId: itemPasta.id, inventoryItemId: invPasta.id, qtyPerItem: 0.2 },
    { menuItemId: itemCola.id, inventoryItemId: invCola.id, qtyPerItem: 1 },
  ];

  for (const m of mappings) {
    await prisma.menuItemInventoryMap.upsert({
      where: {
        menuItemId_inventoryItemId: {
          menuItemId: m.menuItemId,
          inventoryItemId: m.inventoryItemId,
        },
      },
      update: {},
      create: m,
    });
  }
  console.log("  Inventory mappings:", mappings.length);

  // 14. Branch settings
  await prisma.branchSettings.upsert({
    where: { branchId: branch.id },
    update: {},
    create: {
      branchId: branch.id,
      tenantId: tenant.id,
      serviceChargeEnabled: false,
      serviceChargeType: "PERCENT",
      serviceChargeValue: 0,
      tipsEnabled: true,
      tipPresetsJson: [10, 15, 20],
      featureFlagsJson: {
        customerOrdering: true,
        kds: true,
        waiterDashboard: true,
        pos: true,
        inventory: true,
        promotions: true,
        aiRecommendations: true,
      },
    },
  });
  console.log("  Branch settings: 1");

  // 15. Branch device (sample KDS device)
  await prisma.branchDevice.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Kitchen Display 1" } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      name: "Kitchen Display 1",
      deviceType: "KDS",
      capabilitiesJson: { screen: "10-inch", orientation: "landscape" },
    },
  });
  console.log("  Branch devices: 1");

  // 16. Table access tags (QR codes for each table)
  const tables = await prisma.table.findMany({ where: { branchId: branch.id } });
  for (const t of tables) {
    const tagCode = `QR-${branch.id}-${t.tableCode}`;
    const existing = await prisma.tableAccessTag.findUnique({ where: { code: tagCode } });
    if (!existing) {
      await prisma.tableAccessTag.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          tableId: t.id,
          code: tagCode,
          type: "QR",
        },
      });
    }
  }
  console.log("  Table access tags:", tables.length);

  // 17. Logical analytics simulator data
  // This replaces static random rows with business-aware behavior:
  // lunch/dinner peaks, weekend lift, weighted item popularity, realistic baskets,
  // calculated taxes/totals, payments, KDS statuses, reviews, and inventory pressure.
  await seedLogicalAnalyticsData({
    tenantId: tenant.id,
    branchId: branch.id,
    days: 30,
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
