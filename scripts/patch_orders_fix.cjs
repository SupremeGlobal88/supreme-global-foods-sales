/**
 * Prebuild script: patch OrdersPage.tsx to fix N/A customer names.
 * Orders store customerId but the display code uses order.customer?.name
 * which is always undefined. We replace it with getCustomer(order)?.name.
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(process.cwd(), "src", "pages", "OrdersPage.tsx");
if (!fs.existsSync(filePath)) {
  console.error("[patch_orders_fix] OrdersPage.tsx not found at", filePath);
  process.exit(0); // Don't fail the build
}

let content = fs.readFileSync(filePath, "utf-8");
let modified = false;

// Patch 1: Table display — replace order.customer?.name with getCustomer(order)?.name
// This fixes the N/A customer names in the orders table
const oldDisplay = /order\.customer\?\.name \|\| "N\/A"/g;
const newDisplay = "(getCustomer(order)?.name || order.customerName || \"N/A\")";
if (oldDisplay.test(content)) {
  content = content.replace(oldDisplay, newDisplay);
  modified = true;
  console.log("[patch_orders_fix] Patched order.customer?.name display");
}

// Patch 2: Expanded order detail view — fix customer name display in expanded rows
const oldExpanded = /expandedOrder === order\.id[\s\S]*?order\.customer\?\.name/g;
if (content.includes("order.customer?.name") && !content.includes("getCustomer(order)?.name")) {
  // Replace remaining order.customer?.name occurrences with getCustomer(order)?.name
  content = content.replace(/order\.customer\?\.name/g, "(getCustomer(order)?.name || order.customerName)");
  modified = true;
  console.log("[patch_orders_fix] Patched remaining order.customer?.name occurrences");
}

// Patch 3: Status card stats — the stats already use trpc.order.getStats, but let's ensure
// the fallback works if stats query returns empty
const statsPattern = /const stats = useMemo\(\(\) => \{\s*return \{\s*total: 0,\s*totalValue: 0,/;
if (statsPattern.test(content)) {
  // Replace the hardcoded zero stats with calculated ones from ordersQuery.data
  content = content.replace(
    /const stats = useMemo\(\(\) => \{\s*return \{\s*total: 0,\s*totalValue: 0,\s*pending: 0,\s*picking: 0,\s*ready: 0,\s*delivered: 0,\s*cancelled: 0,\s*quotes: 0\s*\};\s*\}, \[\]\);/,
    `const stats = useMemo(() => {
      const orders = ordersQuery.data || [];
      return {
        total: orders.length,
        totalValue: orders.reduce((sum, o) => sum + (o.total || 0), 0),
        pending: orders.filter(o => o.status === "pending").length,
        picking: orders.filter(o => o.status === "picking").length,
        ready: orders.filter(o => o.status === "ready").length,
        delivered: orders.filter(o => o.status === "delivered").length,
        cancelled: orders.filter(o => o.status === "cancelled").length,
        quotes: orders.filter(o => o.orderType === "quote").length,
      };
    }, [ordersQuery.data]);`
  );
  modified = true;
  console.log("[patch_orders_fix] Patched stats calculation");
}

if (modified) {
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("[patch_orders_fix] OrdersPage.tsx patched successfully");
} else {
  console.log("[patch_orders_fix] No patches needed or already patched");
}
