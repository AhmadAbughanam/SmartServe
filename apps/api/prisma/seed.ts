import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

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
    { code: "T1", capacity: 4, zone: "Main", location: undefined as string | undefined },
    { code: "T2", capacity: 2, zone: "Main", location: undefined as string | undefined },
    { code: "T3", capacity: 6, zone: "Main", location: undefined as string | undefined },
    { code: "T4", capacity: 4, zone: "Patio", location: "Patio" },
    { code: "T5", capacity: 8, zone: "Private", location: "Private room" },
  ];

  for (const t of tableDefs) {
    await prisma.table.upsert({
      where: {
        branchId_tableCode: { branchId: branch.id, tableCode: t.code },
      },
      update: { zone: t.zone },
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
  console.log("  Categories: 3");

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
  console.log("  Menu items: 5");

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

  // 17. Review sentiment demo data
  const reviewOrderIds = [
    "seed-review-order-prev-1",
    "seed-review-order-prev-2",
    "seed-review-order-1",
    "seed-review-order-2",
    "seed-review-order-3",
    "seed-review-order-4",
    "seed-review-order-5",
  ];
  await prisma.review.deleteMany({ where: { orderId: { in: reviewOrderIds } } });
  await prisma.payment.deleteMany({ where: { orderId: { in: reviewOrderIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: reviewOrderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: reviewOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: reviewOrderIds } } });

  const reviewTable = tables.find((t) => t.tableCode === "T3") ?? tables[0];
  if (reviewTable) {
    const reviewSession = await prisma.session.upsert({
      where: { id: "seed-review-session-1" },
      update: {
        tenantId: tenant.id,
        branchId: branch.id,
        tableId: reviewTable.id,
        status: "COMPLETED",
        guestCount: 2,
        endTime: new Date("2026-05-04T21:00:00.000Z"),
      },
      create: {
        id: "seed-review-session-1",
        tenantId: tenant.id,
        branchId: branch.id,
        tableId: reviewTable.id,
        status: "COMPLETED",
        guestCount: 2,
        startTime: new Date("2026-05-01T18:00:00.000Z"),
        endTime: new Date("2026-05-04T21:00:00.000Z"),
      },
    });

    const reviewSeeds = [
      {
        orderId: "seed-review-order-prev-1",
        createdAt: "2026-04-24T18:30:00.000Z",
        rating: 2,
        issueTags: ["COLD"] as string[],
        items: [
          { item: itemPasta, rating: 2 },
          { item: itemCola, rating: 4 },
        ],
      },
      {
        orderId: "seed-review-order-prev-2",
        createdAt: "2026-04-25T19:10:00.000Z",
        rating: 3,
        issueTags: ["COLD"] as string[],
        items: [
          { item: itemBurger, rating: 3 },
          { item: itemJuice, rating: 4 },
        ],
      },
      {
        orderId: "seed-review-order-1",
        createdAt: "2026-05-01T18:30:00.000Z",
        rating: 5,
        issueTags: [] as string[],
        items: [
          { item: itemBurger, rating: 5 },
          { item: itemJuice, rating: 5 },
        ],
      },
      {
        orderId: "seed-review-order-2",
        createdAt: "2026-05-02T19:10:00.000Z",
        rating: 4,
        issueTags: ["LATE"],
        items: [
          { item: itemBurger, rating: 3 },
          { item: itemCola, rating: 4 },
        ],
      },
      {
        orderId: "seed-review-order-3",
        createdAt: "2026-05-03T20:05:00.000Z",
        rating: 3,
        issueTags: ["LATE", "COLD"],
        items: [
          { item: itemPasta, rating: 2 },
          { item: itemCola, rating: 4 },
        ],
      },
      {
        orderId: "seed-review-order-4",
        createdAt: "2026-05-04T13:20:00.000Z",
        rating: 2,
        issueTags: ["LATE", "WRONG_ITEM"],
        items: [
          { item: itemBurger, rating: 2 },
          { item: itemPasta, rating: 3 },
        ],
      },
      {
        orderId: "seed-review-order-5",
        createdAt: "2026-05-04T20:45:00.000Z",
        rating: 4,
        issueTags: ["COLD"],
        items: [
          { item: itemPasta, rating: 3 },
          { item: itemJuice, rating: 5 },
        ],
      },
    ];

    for (const seedReview of reviewSeeds) {
      const subtotal = seedReview.items.reduce((sum, entry) => sum + Number(entry.item.price), 0);
      const tax = seedReview.items.reduce(
        (sum, entry) => sum + Number(entry.item.price) * (entry.item.taxClass === "BEVERAGE" ? 0.1 : 0.05),
        0,
      );
      const total = subtotal + tax;

      await prisma.order.create({
        data: {
          id: seedReview.orderId,
          tenantId: tenant.id,
          branchId: branch.id,
          sessionId: reviewSession.id,
          orderDateTime: new Date(seedReview.createdAt),
          orderStatus: "COMPLETED",
          paymentStatus: "PAID",
          source: "USER_APP",
          subtotalAmount: subtotal,
          taxAmount: tax,
          serviceChargeAmount: 0,
          discountAmount: 0,
          totalAmount: total,
          orderItems: {
            create: seedReview.items.map((entry) => ({
              tenantId: tenant.id,
              branchId: branch.id,
              menuItemId: entry.item.id,
              quantity: 1,
              itemBasePrice: entry.item.price,
              lineDiscountAmount: 0,
              lineTaxAmount: Number(entry.item.price) * (entry.item.taxClass === "BEVERAGE" ? 0.1 : 0.05),
              lineTotal: Number(entry.item.price) * (entry.item.taxClass === "BEVERAGE" ? 1.1 : 1.05),
              kitchenStatus: "READY",
            })),
          },
          statusHistory: {
            create: {
              tenantId: tenant.id,
              branchId: branch.id,
              toStatus: "COMPLETED",
              changedAt: new Date(seedReview.createdAt),
            },
          },
          payments: {
            create: {
              tenantId: tenant.id,
              branchId: branch.id,
              sessionId: reviewSession.id,
              amount: total,
              paymentMethod: "CARD",
              paymentStatus: "COMPLETED",
              paymentDate: new Date(seedReview.createdAt),
              payerType: "CUSTOMER",
            },
          },
        },
      });

      await prisma.review.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          orderId: seedReview.orderId,
          overallRating: seedReview.rating,
          comment: "Seed review comment hidden from sentiment UI",
          createdAt: new Date(seedReview.createdAt),
          issueTags: {
            create: seedReview.issueTags.map((tag) => ({ tag })),
          },
          itemReviews: {
            create: seedReview.items.map((entry) => ({
              menuItemId: entry.item.id,
              rating: entry.rating,
              comment: "Seed item review comment hidden from sentiment UI",
            })),
          },
        },
      });
    }
  }
  console.log("  Review sentiment demo reviews:", reviewOrderIds.length);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
