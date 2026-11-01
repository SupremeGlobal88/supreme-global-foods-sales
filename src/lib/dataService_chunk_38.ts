        }
      }
    }
  } catch { /* ignore */ }

  // 2. Allow "admin" as a generic alias — match against ANY hardcoded admin/super_admin PIN
  if (ADMIN_ALIASES.includes(typedName)) {
    // First check stored users for admin alias (new PIN may have been changed)
    let storedAdminFound: any = null;
    try {
      const raw = getStorageItem("sgf_users");
      if (raw) {
        const stored = JSON.parse(raw);
        storedAdminFound = stored.find(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) === typedPin && x.isActive !== false
        );
      }
    } catch { /* ignore */ }
    if (storedAdminFound) {
      return { id: storedAdminFound.id, name: storedAdminFound.name, email: storedAdminFound.email, role: storedAdminFound.role, pin: storedAdminFound.pin };
    }

    // Only fall back to hardcoded if no stored admin with different PIN exists
    let storedAdminWithDifferentPin = false;
    try {
      const raw = getStorageItem("sgf_users");
      if (raw) {
        const stored = JSON.parse(raw);
        storedAdminWithDifferentPin = stored.some(
          (x: any) => (x.role === "admin" || x.role === "super_admin") && String(x.pin) !== typedPin && x.isActive !== false
        );
      }
    } catch { /* ignore */ }

    if (!storedAdminWithDifferentPin) {
      const adminMatch = DEFAULT_USERS.find(
        (u) => (u.role === "admin" || u.role === "super_admin") && String(u.pin) === typedPin
      );
      if (adminMatch) {
        return { id: adminMatch.id, name: adminMatch.name, email: adminMatch.email, role: adminMatch.role, pin: adminMatch.pin };
      }
    }
  }

  // 3. Check hardcoded defaults (fallback — survives data clears)
  // BUT only if the user does NOT exist in stored data with a different PIN.
  // This prevents old hardcoded PINs from working after a PIN change.
  let storedUserWithDifferentPin: any = null;
  try {
    const raw = getStorageItem("sgf_users");
    if (raw) {
      const stored = JSON.parse(raw);
      storedUserWithDifferentPin = stored.find(
        (x: any) => x.name?.toLowerCase() === typedName && String(x.pin) !== typedPin && x.isActive !== false
      );
    }
  } catch { /* ignore */ }

  if (!storedUserWithDifferentPin) {
    const fromDefaults = DEFAULT_USERS.find(
      (u) => u.name.toLowerCase() === typedName && String(u.pin) === typedPin
    );
    if (fromDefaults) {
      // Do NOT re-add missing default users here — if an admin deleted a user,
      // they must stay deleted. Re-adding causes "jumping back" bug.
      // Defaults are only injected on first app load when users array is empty.
      return { id: fromDefaults.id, name: fromDefaults.name, email: fromDefaults.email, role: fromDefaults.role, pin: fromDefaults.pin };
    }
  }

  return null;
}

// NOTE: load() is already called at line 143 after all module-level variables are declared.
// Do NOT call load() again here — it would overwrite in-memory data with stale localStorage.

function getEffectivePrice(stockItemId: number, priceTier: string, customerId: number, _isSample: boolean = false): number {
  // CRITICAL: Sample orders must ALWAYS use corporate price.
  // Do NOT apply special/customer prices to sample orders, even if a
  // special price exists for this customer+product combination.
  if (!_isSample) {
    const sp = specialPrices.find((p) => p.customerId == customerId && p.stockItemId == stockItemId);
    if (sp) return Number(sp.specialPrice);
  }
  const stock = products.find((p) => p.id == stockItemId);
  if (!stock) return 0;
  let rawPrice: number;
  switch (priceTier) {
    case "corporate": rawPrice = Number(stock.corporatePrice); break;
    case "bulk": rawPrice = Number(stock.bulkPrice); break;
    case "retail": rawPrice = Number(stock.retailPrice); break;
    default: rawPrice = Number(stock.wholesalePrice); break;
  }
  // Fallback to STATIC_PRODUCTS if loaded price is 0
  if (rawPrice <= 0) {
    const staticProd = STATIC_PRODUCTS.find((p: any) =>
      p.id == stockItemId ||
      (stock.productCode && p.productCode === stock.productCode) ||
      (stock.productName && p.productName && String(p.productName).toLowerCase().trim() === String(stock.productName).toLowerCase().trim())
    );
    if (staticProd) {
      switch (priceTier) {
        case "corporate": rawPrice = Number(staticProd.corporatePrice); break;
        case "bulk": rawPrice = Number(staticProd.bulkPrice); break;
        case "retail": rawPrice = Number(staticProd.retailPrice); break;
        default: rawPrice = Number(staticProd.wholesalePrice); break;
      }
    }
  }
  return rawPrice;
}

export { dataService };
