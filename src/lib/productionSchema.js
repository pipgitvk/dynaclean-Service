// src/lib/productionSchema.js
import { getDbConnection } from "@/lib/db";

export async function ensureProductionTables() {
  const conn = await getDbConnection();
  // bom
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS bom (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(255) NOT NULL UNIQUE,
      items_json LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin CHECK (json_valid(items_json)),
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // production
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS production (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_code VARCHAR(255) NOT NULL,
      expected_date DATE NULL,
      status ENUM('pending','processing','completed') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prod_code (product_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  // bom_transaction
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS bom_transaction (
      id INT AUTO_INCREMENT PRIMARY KEY,
      production_id INT NOT NULL,
      spare_id INT NOT NULL,
      quantity INT NOT NULL,
      godown VARCHAR(255) DEFAULT NULL,
      note VARCHAR(255) DEFAULT NULL,
      issued_by VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_prod (production_id),
      INDEX idx_spare (spare_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}