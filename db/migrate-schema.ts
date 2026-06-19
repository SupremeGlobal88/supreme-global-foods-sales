import { getDb } from "../api/queries/connection";

async function migrate() {
  const db = getDb();

  // Drop old stock_items table and recreate with new schema
  await db.execute(`DROP TABLE IF EXISTS stock_items`);
  await db.execute(`
    CREATE TABLE stock_items (
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
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
  console.log("stock_items table recreated");

  // Ensure customer_special_prices table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_special_prices (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      customerId bigint unsigned NOT NULL,
      stockItemId bigint unsigned NOT NULL,
      specialPrice decimal(10,2) NOT NULL,
      createdBy bigint unsigned,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
  console.log("customer_special_prices table ensured");

  // Ensure orders table has priceTier column
  try {
    await db.execute(`ALTER TABLE orders ADD COLUMN priceTier enum('corporate','bulk','wholesale','retail') NOT NULL DEFAULT 'wholesale'`);
    console.log("Added priceTier to orders");
  } catch {
    console.log("priceTier already exists on orders");
  }

  console.log("Schema migration complete!");
}

migrate().catch(console.error);
