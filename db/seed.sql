-- HIMS Sample Data Seed Script

-- 0. Users (Initial Super Admin: username=superadmin, password=admin1234)
INSERT INTO users (id, name, username, password_hash, role) VALUES 
(1, 'Super Administrator', 'superadmin', '$2b$10$u4g8ILfnWnw6oEOEsLthR.Nrwa21k9mXMEJf5p8S.lQwOceLiNi.u', 'SUPER_ADMIN');

-- 1. Categories
INSERT INTO categories (name, parent_id) VALUES 
('Networking', NULL),
('Computing', NULL),
('Peripherals', NULL);

SET @net_id = (SELECT id FROM categories WHERE name = 'Networking');
SET @comp_id = (SELECT id FROM categories WHERE name = 'Computing');

INSERT INTO categories (name, parent_id) VALUES 
('Routers', @net_id),
('Switches', @net_id),
('Laptops', @comp_id),
('Desktops', @comp_id);

-- 2. Warehouses and Shops
INSERT INTO warehouses (name, location, type) VALUES 
('Central Hub', 'Chicago, IL', 'WAREHOUSE'),
('West Coast Annex', 'San Francisco, CA', 'WAREHOUSE'),
('East Distribution', 'New Jersey, NY', 'WAREHOUSE'),
('Downtown Retail Shop', 'Chicago, IL', 'SHOP'),
('West End Retail', 'San Francisco, CA', 'SHOP');

-- 3. Products
INSERT INTO products (name, sku, category_id) VALUES 
('Cisco Catalyst 9300', 'NET-SW-001', (SELECT id FROM categories WHERE name = 'Switches')),
('Ubiquiti Dream Machine', 'NET-RT-001', (SELECT id FROM categories WHERE name = 'Routers')),
('MacBook Pro 16" M3', 'CMP-LP-001', (SELECT id FROM categories WHERE name = 'Laptops')),
('Dell XPS 15', 'CMP-LP-002', (SELECT id FROM categories WHERE name = 'Laptops')),
('Logitech MX Master 3S', 'PER-MS-001', (SELECT id FROM categories WHERE name = 'Peripherals'));

-- 4. Initial Inventory
INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES 
(1, 1, 50),
(1, 4, 15),
(1, 5, 5),
(2, 1, 15),
(2, 4, 5),
(3, 1, 10),
(3, 4, 3),
(4, 3, 25),
(4, 4, 2),
(5, 1, 100),
(5, 4, 20);

-- 5. Sample Transactions (to test analytics)
-- Let's make Cisco Catalyst the "Best Performing Product"
INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id, is_sale, timestamp) VALUES 
(1, 4, 'OUT', 12, 1, 1, CURRENT_TIMESTAMP),
(1, 5, 'OUT', 3, 1, 1, CURRENT_TIMESTAMP),
(2, 4, 'OUT', 2, 1, 1, CURRENT_TIMESTAMP),
(3, 4, 'OUT', 1, 1, 1, CURRENT_TIMESTAMP),
(4, 4, 'OUT', 2, 1, 1, CURRENT_TIMESTAMP);
