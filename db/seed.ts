import { getDb } from "../api/queries/connection";
import { stockItems, customers } from "./schema";
import productsData from "./products-data.json";

async function seed() {
  const db = getDb();
  console.log("Seeding database with Supreme Global Foods product catalog...");

  // Clear existing stock
  await db.delete(stockItems);
  console.log("Cleared existing stock items");

  // Seed all products from the price list
  let count = 0;
  for (const product of productsData) {
    const qty = product.quantity;
    const status = qty === 0 ? "out_of_stock" : qty < 20 ? "low_stock" : "in_stock";
    await db.insert(stockItems).values({
      productCode: product.productCode,
      productName: product.productName,
      category: product.category,
      strands: product.strands || null,
      size: product.size || null,
      grade: product.grade || null,
      color: product.color || null,
      species: product.species || null,
      origin: product.origin || null,
      quantity: product.quantity,
      corporatePrice: product.corporatePrice.toFixed(2),
      bulkPrice: product.bulkPrice.toFixed(2),
      wholesalePrice: product.wholesalePrice.toFixed(2),
      retailPrice: product.retailPrice.toFixed(2),
      status: status as "in_stock" | "low_stock" | "out_of_stock",
    });
    count++;
  }
  console.log(`Seeded ${count} products`);

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
  console.log(`Seeded ${customerData.length} customers`);
  console.log("Done!");
}

seed().catch(console.error);
