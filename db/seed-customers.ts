import { getDb } from "../api/queries/connection";
import { customers } from "./schema";
import customersData from "./customers-data.json";

async function seedCustomers() {
  const db = getDb();
  console.log(`Seeding ${customersData.length} customers from Customer Existing List June 2026...`);

  // 1. Add priceTier column to customers if not exists
  try {
    await db.execute("ALTER TABLE customers ADD COLUMN priceTier enum('corporate','bulk','wholesale','retail') NOT NULL DEFAULT 'wholesale'");
    console.log("Added priceTier column to customers table");
  } catch (e: any) {
    if (e.sqlMessage?.includes("Duplicate")) {
      console.log("priceTier column already exists on customers");
    } else {
      console.log("Note:", e.sqlMessage || e.message);
    }
  }

  // 2. Clear existing customers
  await db.execute("SET FOREIGN_KEY_CHECKS = 0");
  await db.execute("TRUNCATE TABLE customers");
  console.log("Cleared existing customers");

  // 3. Insert all customers in batches
  const batchSize = 25;
  let count = 0;

  for (let i = 0; i < customersData.length; i += batchSize) {
    const batch = customersData.slice(i, i + batchSize);
    const values = batch.map((c: any) => {
      const esc = (s: string | null) => s ? s.replace(/'/g, "\\'") : '';
      return `(
        '${esc(c.customerCode)}',
        '${esc(c.name)}',
        ${c.businessName ? `'${esc(c.businessName)}'` : 'NULL'},
        ${c.contactPerson ? `'${esc(c.contactPerson)}'` : 'NULL'},
        ${c.phone ? `'${esc(c.phone)}'` : 'NULL'},
        ${c.email ? `'${esc(c.email)}'` : 'NULL'},
        ${c.physicalAddress ? `'${esc(c.physicalAddress)}'` : 'NULL'},
        ${c.city ? `'${esc(c.city)}'` : 'NULL'},
        ${c.province ? `'${esc(c.province)}'` : 'NULL'},
        ${c.postalCode ? `'${esc(c.postalCode)}'` : 'NULL'},
        '${c.paymentTerms}',
        '${c.priceTier}',
        ${c.vatNumber ? `'${esc(c.vatNumber)}'` : 'NULL'},
        ${c.notes ? `'${esc(c.notes)}'` : 'NULL'},
        '${c.isActive}'
      )`;
    }).join(",");

    const sql = `INSERT INTO customers 
      (customerCode, name, businessName, contactPerson, phone, email, physicalAddress, city, province, postalCode, paymentTerms, priceTier, vatNumber, notes, isActive) 
      VALUES ${values}`;

    await db.execute(sql);
    count += batch.length;
    if (count % 100 === 0 || count === customersData.length) {
      console.log(`  Inserted ${count}/${customersData.length} customers...`);
    }
  }

  await db.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("Foreign key checks re-enabled");

  // 4. Verify
  const result = await db.execute("SELECT COUNT(*) as count FROM customers");
  const total = (result[0] as any)[0].count;
  console.log(`\n=== Customer Import Complete! ===`);
  console.log(`Total customers in database: ${total}`);
  console.log(`Pricing tier breakdown:`);
  const tiers = await db.execute("SELECT priceTier, COUNT(*) as count FROM customers GROUP BY priceTier ORDER BY count DESC");
  for (const row of (tiers[0] as any)) {
    console.log(`  ${row.priceTier}: ${row.count}`);
  }
  console.log(`Payment terms breakdown:`);
  const terms = await db.execute("SELECT paymentTerms, COUNT(*) as count FROM customers GROUP BY paymentTerms ORDER BY count DESC");
  for (const row of (terms[0] as any)) {
    console.log(`  ${row.paymentTerms}: ${row.count}`);
  }
}

seedCustomers().catch((err) => {
  console.error("Customer seeding failed:", err);
  process.exit(1);
});
