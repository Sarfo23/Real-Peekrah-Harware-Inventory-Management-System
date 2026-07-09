-- Best Performing Product Query
-- Calculates the product with the highest sum of sale ('is_sale = 1') transactions for the current month.

SELECT 
    p.id,
    p.name,
    p.sku,
    SUM(t.quantity) as total_units_sold
FROM 
    products p
JOIN 
    transactions t ON p.id = t.product_id
WHERE 
    t.is_sale = 1
    AND t.timestamp >= DATE_FORMAT(NOW() ,'%Y-%m-01') -- Start of current month
    AND t.timestamp < DATE_FORMAT(NOW() + INTERVAL 1 MONTH ,'%Y-%m-01') -- Start of next month
GROUP BY 
    p.id, p.name, p.sku
ORDER BY 
    total_units_sold DESC
LIMIT 1;
