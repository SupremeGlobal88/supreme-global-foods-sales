import { getDb } from "../api/queries/connection";
import { stockItems, customers } from "./schema";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Seed stock items - Supreme Global Foods products
  const stockData = [
    { productCode: "SC20-BRN", productName: "Sheep Casings 20 Mega Long Value Brown 2 Metre", category: "Sheep Casings", quantity: 150, unitPrice: "145.00", description: "Premium brown sheep casings, 20mm diameter, 2 metre length" },
    { productCode: "SC28-WHT", productName: "Sheep Casings 28 Mega Long Value White 2 Metre", category: "Sheep Casings", quantity: 120, unitPrice: "280.00", description: "Premium white sheep casings, 28mm diameter, 2 metre length" },
    { productCode: "HC-ULT-BRN", productName: "Hog Casings Ultra Long Value Brown 3 Metre", category: "Hog Casings", quantity: 80, unitPrice: "330.00", description: "Ultra long hog casings, brown, 3 metre length" },
    { productCode: "HC-SUP-BLK", productName: "Hog Casings Super Long Value Black 2 Metre", category: "Hog Casings", quantity: 95, unitPrice: "310.00", description: "Super long hog casings, black, 2 metre length" },
    { productCode: "HC-SUP-YLW", productName: "Hog Casings Super Long Value Yellow 2 Metre", category: "Hog Casings", quantity: 200, unitPrice: "250.00", description: "Super long hog casings, yellow, 2 metre length - Best Seller" },
    { productCode: "SC24-WHT", productName: "Sheep Casings 24 Long Value White 2 Metre", category: "Sheep Casings", quantity: 45, unitPrice: "195.00", description: "Sheep casings 24mm, white, 2 metre length" },
    { productCode: "HC-LONG-SET", productName: "Hog Casings Long Value Set Mixed Colours", category: "Hog Casings", quantity: 60, unitPrice: "450.00", description: "Mixed colour set of premium hog casings" },
    { productCode: "SC22-BRN", productName: "Sheep Casings 22 Long Value Brown 2 Metre", category: "Sheep Casings", quantity: 12, unitPrice: "165.00", description: "Sheep casings 22mm, brown, 2 metre length" },
    { productCode: "HC-ECONO", productName: "Hog Casings Economy Pack 2 Metre", category: "Hog Casings", quantity: 0, unitPrice: "180.00", description: "Economy pack hog casings, 2 metre length" },
    { productCode: "SC26-WHT", productName: "Sheep Casings 26 Mega Long Value White 2 Metre", category: "Sheep Casings", quantity: 18, unitPrice: "220.00", description: "Sheep casings 26mm, white, 2 metre length" },
  ];

  for (const item of stockData) {
    const qty = item.quantity;
    const status = qty === 0 ? "out_of_stock" : qty < 20 ? "low_stock" : "in_stock";
    await db.insert(stockItems).values({ ...item, status: status as "in_stock" | "low_stock" | "out_of_stock" });
  }

  // Seed customers
  const customerData = [
    { customerCode: "CUST001", name: "Braai Masters Butchery", businessName: "Braai Masters (Pty) Ltd", contactPerson: "John Khumalo", phone: "+27114567890", email: "orders@braaimasters.co.za", physicalAddress: "45 Main Road", city: "Germiston", province: "Gauteng", postalCode: "1401", paymentTerms: "30_days" as const, vatNumber: "4120123456" },
    { customerCode: "CUST002", name: "Golden Deli Meats", businessName: "Golden Deli Meats CC", contactPerson: "Sarah van der Merwe", phone: "+27115678901", email: "sarah@goldendeli.co.za", physicalAddress: "12 Industrial Avenue", city: "Johannesburg", province: "Gauteng", postalCode: "2001", paymentTerms: "14_days" as const, vatNumber: "4120234567" },
    { customerCode: "CUST003", name: "Premium Sausage Co.", businessName: "Premium Sausage Company", contactPerson: "Michael Nkosi", phone: "+27116789012", email: "michael@premiumsausage.co.za", physicalAddress: "78 Factory Lane", city: "Boksburg", province: "Gauteng", postalCode: "1459", paymentTerms: "7_days" as const, vatNumber: "4120345678" },
    { customerCode: "CUST004", name: "The Butcher's Block", businessName: "Butcher's Block Retail", contactPerson: "Emma Pretorius", phone: "+27117890123", email: "emma@butchersblock.co.za", physicalAddress: "23 Shoprite Centre", city: "Benoni", province: "Gauteng", postalCode: "1501", paymentTerms: "cod" as const },
    { customerCode: "CUST005", name: "Farm Fresh Meats", businessName: "Farm Fresh Meats SA", contactPerson: "David Mokoena", phone: "+27118901234", email: "david@farmfresh.co.za", physicalAddress: "156 Agricultural Road", city: "Pretoria", province: "Gauteng", postalCode: "0183", paymentTerms: "30_days" as const, vatNumber: "4120456789" },
    { customerCode: "CUST006", name: "Casa de Embutidos", businessName: "Casa de Embutidos Lda", contactPerson: "Maria Silva", phone: "+27119012345", email: "maria@casadeembutidos.co.za", physicalAddress: "89 Portuguese Quarter", city: "Johannesburg", province: "Gauteng", postalCode: "2094", paymentTerms: "14_days" as const },
  ];

  for (const cust of customerData) {
    await db.insert(customers).values(cust);
  }

  console.log("Seeded successfully!");
}

seed().catch(console.error);
