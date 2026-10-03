# Apply Orders Fix

The fix for the N/A customer names bug is ready in the `scripts/` folder.

## To apply the fix:

1. Make any small change to any file (like adding a space to this file) and commit it
2. The deploy workflow will automatically apply the fix before building

Or run this locally:
```bash
node scripts/combine_orders_fix.js
git add src/pages/OrdersPage.tsx
git commit -m "Fix order customer lookup"
git push
```