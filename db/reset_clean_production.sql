-- HIMS Production Launch Reset Script
-- WARNING: This deletes all test transactions, inventory levels, and products,
-- but preserves your configured Warehouses, Shops, and Categories so you do not have to recreate them.

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Wipe test transaction logs & inventory counts
TRUNCATE TABLE transactions;
TRUNCATE TABLE inventory;

-- 2. Wipe test products catalog
TRUNCATE TABLE products;

-- 3. Reset product cumulative quantity counts
UPDATE products SET cumulative_quantity = 0;

SET FOREIGN_KEY_CHECKS = 1;

-- Output confirmation
SELECT 'Test products and transactions wiped. Facilities and Categories preserved!' as Status;
