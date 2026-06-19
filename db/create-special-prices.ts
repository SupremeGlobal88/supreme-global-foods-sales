import { getDb } from '../api/queries/connection';

async function main() {
  const db = getDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customer_special_prices (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      customerId bigint unsigned NOT NULL,
      stockItemId bigint unsigned NOT NULL,
      specialPrice decimal(10,2) NOT NULL,
      createdBy bigint unsigned DEFAULT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    )
  `);
  console.log('customer_special_prices table created successfully');
}

main().catch(console.error);
