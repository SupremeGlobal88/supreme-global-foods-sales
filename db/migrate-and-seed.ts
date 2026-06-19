import { getDb } from "../api/queries/connection";
import { stockItems, customers, orders } from "./schema";
import productsData from "./products-data.json";

async function migrateAndSeed() {
  const db = getDb();
  console.log("Starting migration...");

  // Disable foreign key checks temporarily
  await db.execute("SET FOREIGN_KEY_CHECKS = 0");
  console.log("Foreign key checks disabled");

  // 1. Drop and recreate stock_items with new schema
  await db.execute("DROP TABLE IF EXISTS stock_items");
  console.log("Dropped old stock_items table");

  await db.execute(`CREATE TABLE stock_items (
    id bigint unsigned NOT NULL AUTO_INCREMENT,
    productCode varchar(50) NOT NULL,
    productName varchar(255) NOT NULL,
    category varchar(100) NOT NULL,
    strands varchar(50),
    size varchar(20),
    grade varchar(10),
    color varchar(50),
    species varchar(20),
    origin varchar(20),
    quantity int NOT NULL DEFAULT 0,
    corporatePrice decimal(10,2) NOT NULL,
    bulkPrice decimal(10,2) NOT NULL,
    wholesalePrice decimal(10,2) NOT NULL,
    retailPrice decimal(10,2) NOT NULL,
    description text,
    status enum('in_stock','low_stock','out_of_stock') NOT NULL DEFAULT 'in_stock',
    uploadedBy bigint unsigned,
    createdAt timestamp NOT NULL DEFAULT (now()),
    updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT stock_items_id PRIMARY KEY(id)
  )`);
  console.log("Created new stock_items table with 4-tier pricing");

  // 2. Add priceTier to orders if not exists
  try {
    await db.execute("ALTER TABLE orders ADD COLUMN priceTier enum('corporate','bulk','wholesale','retail') NOT NULL DEFAULT 'wholesale'");
    console.log("Added priceTier column to orders");
  } catch (e: any) {
    if (e.sqlMessage?.includes("Duplicate")) {
      console.log("priceTier column already exists on orders");
    } else {
      console.log("Note:", e.sqlMessage || e.message);
    }
  }

  // 3. Seed all 196 products
  console.log(`Seeding ${productsData.length} products...`);
  let count = 0;
  const batchSize = 20;
  
  for (let i = 0; i < productsData.length; i += batchSize) {
    const batch = productsData.slice(i, i + batchSize);
    const values = batch.map((p: any) => {
      const qty = p.quantity || 0;
      const status = qty === 0 ? "out_of_stock" : qty < 20 ? "low_stock" : "in_stock";
      return `('${p.productCode.replace(/'/g, "\\'")}', '${p.productName.replace(/'/g, "\\'")}', '${p.category.replace(/'/g, "\\'")}', ${p.strands ? `'${p.strands.replace(/'/g, "\\'")}'` : "NULL"}, ${p.size ? `'${p.size}'` : "NULL"}, ${p.grade ? `'${p.grade}'` : "NULL"}, ${p.color ? `'${p.color.replace(/'/g, "\\'")}'` : "NULL"}, ${p.species ? `'${p.species}'` : "NULL"}, ${p.origin ? `'${p.origin}'` : "NULL"}, ${qty}, ${p.corporatePrice.toFixed(2)}, ${p.bulkPrice.toFixed(2)}, ${p.wholesalePrice.toFixed(2)}, ${p.retailPrice.toFixed(2)}, '${status}')`;
    }).join(",");

    const sql = `INSERT INTO stock_items (productCode, productName, category, strands, size, grade, color, species, origin, quantity, corporatePrice, bulkPrice, wholesalePrice, retailPrice, status) VALUES ${values}`;
    await db.execute(sql);
    count += batch.length;
    console.log(`  Seeded ${count}/${productsData.length} products...`);
  }

  // Re-enable foreign key checks
  await db.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Foreign key checks re-enabled");

  // 4. Seed customers
  const existingCustomers = await db.execute("SELECT COUNT(*) as count FROM customers");
  const customerCount = (existingCustomers[0] as any)?.[0]?.count || 0;
  
  if (customerCount === 0) {
    console.log("Seeding customers...");
    const customerData = [
      { customerCode: "CUST001", name: "Braai Masters Butchery", businessName: "Braai Masters (Pty) Ltd", contactPerson: "John Khumalo", phone: "+27114567890", email: "orders@braaimasters.co.za", physicalAddress: "45 Main Road", city: "Germiston", province: "Gauteng", postalCode: "1401", paymentTerms: "30_days", vatNumber: "4120123456" },
      { customerCode: "CUST002", name: "Golden Deli Meats", businessName: "Golden Deli Meats CC", contactPerson: "Sarah van der Merwe", phone: "+27115678901", email: "sarah@goldendeli.co.za", physicalAddress: "12 Industrial Avenue", city: "Johannesburg", province: "Gauteng", postalCode: "2001", paymentTerms: "14_days", vatNumber: "4120234567" },
      { customerCode: "CUST003", name: "Premium Sausage Co.", businessName: "Premium Sausage Company", contactPerson: "Michael Nkosi", phone: "+27116789012", email: "michael@premiumsausage.co.za", physicalAddress: "78 Factory Lane", city: "Boksburg", province: "Gauteng", postalCode: "1459", paymentTerms: "7_days", vatNumber: "4120345678" },
      { customerCode: "CUST004", name: "The Butcher's Block", businessName: "Butcher's Block Retail", contactPerson: "Emma Pretorius", phone: "+27117890123", email: "emma@butchersblock.co.za", physicalAddress: "23 Shoprite Centre", city: "Benoni", province: "Gauteng", postalCode: "1501", paymentTerms: "cod" },
      { customerCode: "CUST005", name: "Farm Fresh Meats", businessName: "Farm Fresh Meats SA", contactPerson: "David Mokoena", phone: "+27118901234", email: "david@farmfresh.co.za", physicalAddress: "156 Agricultural Road", city: "Pretoria", province: "Gauteng", postalCode: "0183", paymentTerms: "30_days", vatNumber: "4120456789" },
      { customerCode: "CUST006", name: "Casa de Embutidos", businessName: "Casa de Embutidos Lda", contactPerson: "Maria Silva", phone: "+27119012345", email: "maria@casadeembutidos.co.za", physicalAddress: "89 Portuguese Quarter", city: "Johannesburg", province: "Gauteng", postalCode: "2094", paymentTerms: "14_days" },
    ];

    for (const cust of customerData) {
      await db.insert(customers).values(cust as any);
    }
    console.log(`Seeded ${customerData.length} customers`);
  } else {
    console.log(`Customers already exist (${customerCount}), skipping customer seed`);
  }

  console.log("\n=== Migration & Seeding Complete! ===");
  console.log(`- ${count} products seeded`);
  console.log("- 4-tier pricing (Corporate/Bulk/Wholesale/Retail) active");
  console.log("- priceTier column on orders");
}

migrateAndSeed().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
