/** ═══════════════════════════════════════════════════════════════
 *  COMPANY CONFIGURATION — Supreme Global Foods & Recircle SA
 *  ═══════════════════════════════════════════════════════════════
 *  Both companies share the same stock on hand and follow the
 *  same corporate customer process, but each has their own
 *  stationary, banking details, and branding on documents.
 */

export type CompanyKey = "sgf" | "recircle";

export interface CompanyConfig {
  key: CompanyKey;
  name: string;
  legalName: string;
  shortName: string;
  tagline: string;
  address: {
    street: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  vatNumber: string;
  contact: {
    phone: string;
    email: string;
  };
  banking: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
    swiftCode: string;
  };
  logoText: string;
  cocHeader: string;
  documentColor: string; // primary brand color for documents
}

const SGF_CONFIG: CompanyConfig = {
  key: "sgf",
  name: "Supreme Global Foods",
  legalName: "Supreme Global Foods (Pty) Ltd",
  shortName: "SGF",
  tagline: "Quality You Can Taste",
  address: {
    street: "28 Nagington Road",
    city: "Wadeville",
    province: "Gauteng",
    postalCode: "1422",
    country: "South Africa",
  },
  vatNumber: "",
  contact: {
    phone: "",
    email: "",
  },
  banking: {
    bankName: "First National Bank (FNB)",
    accountName: "Supreme Global Foods",
    accountNumber: "62001234567",
    branchCode: "250655",
    swiftCode: "FIRNZAJJ",
  },
  logoText: "SUPREME GLOBAL FOODS",
  cocHeader: "CERTIFICATE OF COMPLIANCE",
  documentColor: "#D4A843",
};

const RECIRCLE_CONFIG: CompanyConfig = {
  key: "recircle",
  name: "Recircle SA",
  legalName: "Recircle SA CC",
  shortName: "RECIRCLE SA",
  tagline: "",
  address: {
    street: "28 Nagington Road",
    city: "Wadeville",
    province: "Gauteng",
    postalCode: "1422",
    country: "South Africa",
  },
  vatNumber: "",
  contact: {
    phone: "",
    email: "",
  },
  banking: {
    bankName: "First National Bank (FNB)",
    accountName: "Recircle SA CC",
    accountNumber: "",
    branchCode: "250655",
    swiftCode: "FIRNZAJJ",
  },
  logoText: "RECIRCLE SA CC",
  cocHeader: "SPECIFICATION SHEET / CERTIFICATE OF COMPLIANCE",
  documentColor: "#0E7490",
};

const COMPANY_MAP: Record<CompanyKey, CompanyConfig> = {
  sgf: SGF_CONFIG,
  recircle: RECIRCLE_CONFIG,
};

/** Get config for a company. Defaults to SGF if invalid. */
export function getCompanyConfig(company?: CompanyKey | string): CompanyConfig {
  if (company === "recircle") return RECIRCLE_CONFIG;
  return SGF_CONFIG;
}

/** Get the other company key */
export function getOtherCompany(company: CompanyKey): CompanyKey {
  return company === "sgf" ? "recircle" : "sgf";
}

/** List all available companies */
export function getAllCompanies(): CompanyConfig[] {
  return [SGF_CONFIG, RECIRCLE_CONFIG];
}

/** Full address as a single string */
export function getFullAddress(company?: CompanyKey | string): string {
  const c = getCompanyConfig(company);
  return `${c.address.street}, ${c.address.city}, ${c.address.province}, ${c.address.postalCode}, ${c.address.country}`;
}

/** Short address for document headers */
export function getShortAddress(company?: CompanyKey | string): string {
  const c = getCompanyConfig(company);
  return `${c.address.street}, ${c.address.city}, ${c.address.province}, ${c.address.country}`;
}
