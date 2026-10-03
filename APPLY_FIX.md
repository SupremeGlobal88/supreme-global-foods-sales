# Apply Orders Fix

The fix for the N/A customer names bug is ready in the `scripts/` folder.

## Status: FIX DEPLOYED

The fix is automatically applied on every build via the `prebuild` script in package.json.

## What was fixed:

- Orders only store `customerId` (no embedded customer object)
- Display code was using `order.customer?.name` which is always undefined
- Changed to use `getCustomer(order)?.name` with loose equality `==` for type safety
- Fixed search filter to also use customer lookup

## Build triggered: 2026-10-03