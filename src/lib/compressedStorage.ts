/**
 * Compressed localStorage wrapper for SGF data keys.
 * Uses LZ-String compression to handle datasets that exceed localStorage quota.
 * Backward-compatible: reads plain JSON if decompression fails.
 */
import LZString from "lz-string";

const COMPRESSED_KEYS = [
  "sgf_orders",
  "sgf_invoices",
  "sgf_customers",
  "sgf_products",
  "sgf_payments",
  "sgf_creditNotes",
  "sgf_purchaseOrders",
  "sgf_warehouses",
  "sgf_users",
  "sgf_salesReps",
  "sgf_followUps",
  "sgf_checkins",
  "sgf_appointments",
  "sgf_corporateCustomers",
  "sgf_barrels",
  "sgf_cocs",
  "sgf_followUpActions",
];

function shouldCompress(key: string): boolean {
  return COMPRESSED_KEYS.some((k) => key.includes(k));
}

export function getStorageItem(key: string, defaultValue: string = "[]"): string {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;

  if (!shouldCompress(key)) return raw;

  // Try decompressed first (new format)
  try {
    const decompressed = LZString.decompressFromUTF16(raw);
    if (decompressed) return decompressed;
  } catch {
    // Not compressed, fall through
  }

  // Fall back to plain JSON (backward compatibility)
  return raw;
}

export function setStorageItem(key: string, value: string): void {
  if (!shouldCompress(key)) {
    localStorage.setItem(key, value);
    return;
  }

  const compressed = LZString.compressToUTF16(value);
  try {
    localStorage.setItem(key, compressed);
  } catch (e: any) {
    if (e.name === "QuotaExceededError" || e.message?.includes("quota")) {
      console.error(`[compressedStorage] Quota exceeded for ${key}. Raw: ${value.length} chars, Compressed: ${compressed.length} chars.`);
      // Last resort: try storing without compression
      try {
        localStorage.setItem(key, value);
        console.warn(`[compressedStorage] Stored ${key} uncompressed as fallback.`);
      } catch (e2) {
        console.error(`[compressedStorage] CRITICAL: Cannot store ${key} even uncompressed.`, e2);
      }
    } else {
      throw e;
    }
  }
}

export function removeStorageItem(key: string): void {
  localStorage.removeItem(key);
}

export function getStorageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}
