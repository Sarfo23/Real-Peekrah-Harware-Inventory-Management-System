-- HIMS Database Reset Script (Full Wipe)
-- WARNING: This will permanently delete all records (products, transactions, inventory, categories, warehouses).

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE transactions;
TRUNCATE TABLE inventory;
TRUNCATE TABLE products;
TRUNCATE TABLE categories;
TRUNCATE TABLE warehouses;

SET FOREIGN_KEY_CHECKS = 1;

-- Output confirmation
SELECT 'Database successfully wiped and reset to a clean, empty state!' as Status;
