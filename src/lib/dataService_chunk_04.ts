  const parsed: BankStatementRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length === 0) continue;
    const invoiceNumber = colInvoiceNo >= 0 ? String(r[colInvoiceNo] || "").trim() : "";
    // Only process SGF invoices
    if (!invoiceNumber || !/^SGF\d+$/i.test(invoiceNumber)) continue;
    const amountPaidRaw = colAmountPaid >= 0 ? r[colAmountPaid] : 0;
    const amountPaid = typeof amountPaidRaw === "number" ? amountPaidRaw : parseFloat(String(amountPaidRaw || "0").replace(/,/g, "")) || 0;
    // Skip rows with zero amount paid (nothing to allocate)
    if (amountPaid <= 0) continue;
    parsed.push({
      rowIndex: i,
      invoiceDate: colInvoiceDate >= 0 ? String(r[colInvoiceDate] || "").trim() : "",
      customerName: colCustomer >= 0 ? String(r[colCustomer] || "").trim() : "",
      invoiceNumber,
      amountDue: colAmountDue >= 0
        ? (typeof r[colAmountDue] === "number" ? r[colAmountDue] : parseFloat(String(r[colAmountDue] || "0").replace(/,/g, "")) || 0)
        : 0,
      amountPaid,
      paidDate: colPaidDate >= 0 && r[colPaidDate] ? String(r[colPaidDate]).trim() : null,
    });
  }

  return parsed;
}

/** Simple string similarity (0-100). 100 = exact match. */
function stringSimilarity(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();
  if (s1 === s2) return 100;
  // Levenshtein distance
  const len = Math.max(s1.length, s2.length);
  if (len === 0) return 100;
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      matrix[i][j] = s1[i - 1] === s2[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  const dist = matrix[s1.length][s2.length];
  return Math.round(((len - dist) / len) * 100);
}

/** ═══════════════════════════════════════════════════════════════
 *  SALES REP REPORTING HELPERS
 *  ═══════════════════════════════════════════════════════════════ */

/** SGF Office coordinates — 28 Nagington Rd, Wadeville, Germiston
 *  All daily routes start and end here. */
const OFFICE_LAT = -26.2596294;
const OFFICE_LNG = 28.1858534;
const OFFICE_NAME = "SGF Office — 28 Nagington Rd, Wadeville";

/** South African AA travel rate per km (configurable, default R5.50/km) */
let AA_RATE_PER_KM = 5.50;
try {
  const stored = getStorageItem("sgf_aaRatePerKm");
  if (stored) { const v = parseFloat(stored); if (!isNaN(v) && v > 0) AA_RATE_PER_KM = v; }
} catch { /* keep default */ }

export function getAARate(): number { return AA_RATE_PER_KM; }
export function setAARate(rate: number): void {
  AA_RATE_PER_KM = rate;
  try { setStorageItem("sgf_aaRatePerKm", String(rate)); } catch { /* ignore */ }
}

/** ISO week number */
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((+date - +yearStart) / 86400000) + 1) / 7);
}

/** Haversine distance between two lat/lng points in kilometers */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Build a report grouped by sales rep from an array of check-ins */
function buildRepReport(
  checkinList: any[],
  periodType: "daily" | "weekly" | "monthly",
  referenceDate: Date,
  year?: number,
  weekOrMonth?: number
): any {
  // Group check-ins by sales rep
  const byRep = new Map<string, any[]>();
  for (const ci of checkinList) {
    const repName = ci.salesRepName || "Unknown";
    if (!byRep.has(repName)) byRep.set(repName, []);
    byRep.get(repName)!.push(ci);
  }

  const repReports: any[] = [];
  let grandTotalKm = 0;
  let grandTotalCost = 0;
  let grandTotalVisits = 0;
  let grandTotalCustomers = 0;

  for (const [repName, repCheckins] of byRep) {
    // Sort by time for distance calculation
    repCheckins.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Calculate distance: Office → Customer 1 → Customer 2 → ... → Last Customer → Office
    let totalKm = 0;
    const routeSegments: any[] = [];

    // Helper to add a segment
    const addSegment = (from: any, to: any) => {
      if (from.lat && from.lng && to.lat && to.lng) {
        const km = haversineKm(from.lat, from.lng, to.lat, to.lng);
        totalKm += km;
        routeSegments.push({
          from: { location: from.location, lat: from.lat, lng: from.lng, time: from.time },
          to: { location: to.location, lat: to.lat, lng: to.lng, time: to.time },
          km: Math.round(km * 100) / 100,
        });
      }
    };

    // 1. Office → First check-in (start of day)
    const first = repCheckins[0];
    if (first) {
      addSegment(
        { location: OFFICE_NAME, lat: OFFICE_LAT, lng: OFFICE_LNG, time: null },
        { location: first.location || "First Visit", lat: first.latitude, lng: first.longitude, time: first.createdAt }
      );
    }

    // 2. Between consecutive check-ins
    for (let i = 1; i < repCheckins.length; i++) {
      const prev = repCheckins[i - 1];
      const curr = repCheckins[i];
      addSegment(
        { location: prev.location || "Unknown", lat: prev.latitude, lng: prev.longitude, time: prev.createdAt },
        { location: curr.location || "Unknown", lat: curr.latitude, lng: curr.longitude, time: curr.createdAt }
      );
    }

    // 3. Last check-in → Office (end of day)
    const last = repCheckins[repCheckins.length - 1];
    if (last) {
      addSegment(
        { location: last.location || "Last Visit", lat: last.latitude, lng: last.longitude, time: last.createdAt },
        { location: OFFICE_NAME, lat: OFFICE_LAT, lng: OFFICE_LNG, time: null }
      );
    }

    // Count unique customers visited
    const uniqueCustomers = new Set(repCheckins.map((ci) => ci.customerId).filter(Boolean));
    const totalVisits = repCheckins.length;
    const totalCost = totalKm * AA_RATE_PER_KM;

    // Build per-visit details
    const visits = repCheckins.map((ci) => ({
      time: ci.createdAt,
      customerName: ci.customer?.name || ci.location || "Unknown",
      customerId: ci.customerId,
      location: ci.location || "",
      latitude: ci.latitude,
      longitude: ci.longitude,
      outcome: ci.outcome || "visit",
      notes: ci.notes || "",
      durationMinutes: ci.durationMinutes || 0,
      status: ci.status,
    }));

    repReports.push({
      salesRep: repName,
      totalVisits,
      uniqueCustomersVisited: uniqueCustomers.size,
      totalKm: Math.round(totalKm * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      aaRatePerKm: AA_RATE_PER_KM,
      routeSegments,
      visits,
    });

