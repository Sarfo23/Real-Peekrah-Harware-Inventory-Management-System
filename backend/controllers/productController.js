import db from '../config/db.js';
import { logFootprint } from '../utils/footprint.js';

/**
 * Product Controller
 * Handles product-related queries and analytics.
 */

// Search products with total stock aggregation
const searchProducts = async (req, res) => {
  const query = req.query.q || '';
  
  if (query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters long' });
  }

  try {
    const [rows] = await db.execute(`
      SELECT 
        p.id, 
        p.name, 
        p.sku, 
        c.name as category_name,
        p.low_stock_threshold,
        COALESCE(SUM(i.quantity), 0) as total_quantity,
        IF(COALESCE(SUM(i.quantity), 0) < p.low_stock_threshold, 1, 0) as is_low_stock,
        GROUP_CONCAT(
          CONCAT(w.id, '::', w.name, '::', w.type, '::', COALESCE(w.location, ''), '::', COALESCE(i.quantity, 0))
          SEPARATOR ';;'
        ) as location_distribution
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE (p.name LIKE ? OR p.sku LIKE ?) AND p.is_decommissioned = 0
      GROUP BY p.id
    `, [`%${query}%`, `%${query}%`]);

    res.json(rows);
  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        p.id, 
        p.name, 
        p.sku, 
        p.category_id, 
        p.low_stock_threshold, 
        COALESCE(SUM(i.quantity), 0) as quantity, 
        p.cumulative_quantity, 
        p.cost_price, 
        p.selling_price 
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_decommissioned = 0
      GROUP BY p.id
      ORDER BY p.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Products Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new product and optionally assign initial inventory
const createProduct = async (req, res) => {
  const { 
    name, 
    sku, 
    categoryId, 
    lowStockThreshold, 
    initialWarehouseId, 
    initialQuantity,
    newWarehouseName,
    newWarehouseLocation
  } = req.body;

  if (!name || !sku || !categoryId) {
    return res.status(400).json({ error: 'Name, SKU, and Category are required fields' });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Insert product record
    const [productResult] = await connection.execute(
      'INSERT INTO products (name, sku, category_id, low_stock_threshold, cost_price, selling_price) VALUES (?, ?, ?, ?, ?, ?)',
      [name, sku, categoryId, lowStockThreshold || 10, req.body.cost_price || 0, req.body.selling_price || 0]
    );

    const newProductId = productResult.insertId;

    // Determine target warehouse ID (either existing or new)
    let targetWarehouseId = initialWarehouseId ? parseInt(initialWarehouseId) : null;

    if (newWarehouseName && newWarehouseName.trim() !== '') {
      // Check if a warehouse with this name already exists
      const [existingWares] = await connection.execute(
        'SELECT id FROM warehouses WHERE name = ?',
        [newWarehouseName.trim()]
      );

      if (existingWares.length > 0) {
        targetWarehouseId = existingWares[0].id;
      } else {
        // Insert new warehouse
        const [warehouseResult] = await connection.execute(
          'INSERT INTO warehouses (name, location) VALUES (?, ?)',
          [newWarehouseName.trim(), newWarehouseLocation ? newWarehouseLocation.trim() : '']
        );
        targetWarehouseId = warehouseResult.insertId;
      }
    }

    // 2. Insert inventory and transaction log if initial allocation is requested
    if (targetWarehouseId && initialQuantity > 0) {
      await connection.execute(
        'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
        [newProductId, targetWarehouseId, initialQuantity]
      );

      await connection.execute(
        'INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id) VALUES (?, ?, ?, ?, ?)',
        [newProductId, targetWarehouseId, 'IN', initialQuantity, req.user ? req.user.id : 1]
      );
    }

    await connection.commit();

    // Log user footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'CREATE_PRODUCT',
      `Created catalog product: "${name}" (SKU: "${sku}").`
    );

    res.status(201).json({ id: newProductId, message: 'Product created and allocated successfully' });

  } catch (error) {
    await connection.rollback();
    console.error('Create Product Error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Product SKU must be unique. This SKU already exists.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
};

// Get the best performing product for the current month
const getBestPerformingProduct = async (req, res) => {
  try {
    const [rows] = await db.execute(`
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
          AND t.timestamp >= DATE_FORMAT(NOW() ,'%Y-%m-01')
          AND t.timestamp < DATE_FORMAT(NOW() + INTERVAL 1 MONTH ,'%Y-%m-01')
      GROUP BY 
          p.id, p.name, p.sku
      ORDER BY 
          total_units_sold DESC
      LIMIT 1
    `);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No performance data found for this month' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Analytics Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update product details
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, sku, categoryId, lowStockThreshold, cost_price, selling_price } = req.body;
  try {
    const [result] = await db.execute(
      'UPDATE products SET name = ?, sku = ?, category_id = ?, low_stock_threshold = ?, cost_price = ?, selling_price = ? WHERE id = ?',
      [name, sku, categoryId, lowStockThreshold, cost_price, selling_price, id]
    );

    // Log user footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'UPDATE_PRODUCT',
      `Updated catalog product: "${name}" (SKU: "${sku}", ID: ${id}).`
    );

    res.json({ message: 'Product updated', affectedRows: result.affectedRows });
  } catch (error) {
    console.error('Update Product Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete product (Decommission)
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const option = req.query.option || 'keepHistory'; // default to safe keepHistory

  const connection = await db.getConnection();
  try {
    // 1. Fetch product details first for logging and checks
    const [prodRows] = await connection.execute('SELECT name, sku FROM products WHERE id = ?', [id]);
    if (prodRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Product not found' });
    }
    const { name, sku } = prodRows[0];

    await connection.beginTransaction();

    if (option === 'keepHistory') {
      // Option A: Decommission but keep transactional history
      // Rename SKU to avoid unique constraint violations if a new product with same SKU is created
      const uniqueSuffix = `${Date.now()}`;
      await connection.execute(
        'UPDATE products SET is_decommissioned = 1, sku = CONCAT(sku, "-decom-", ?) WHERE id = ?',
        [uniqueSuffix, id]
      );

      // Remove current warehouse inventory mappings so stock is zeroed out/not active
      await connection.execute('DELETE FROM inventory WHERE product_id = ?', [id]);

      await connection.commit();

      // Log user footprint
      await logFootprint(
        req.user ? req.user.id : 1,
        'DECOMMISSION_PRODUCT_KEEP_HISTORY',
        `Decommissioned product: "${name}" (SKU: "${sku}", ID: ${id}), retaining transaction history.`
      );

      res.json({ message: 'Product decommissioned successfully, transactional history kept.' });
    } else if (option === 'deleteHistory') {
      // Option B: Complete wipe (delete product and all transactional history)
      // Delete transactions
      await connection.execute('DELETE FROM transactions WHERE product_id = ?', [id]);

      // Delete inventory
      await connection.execute('DELETE FROM inventory WHERE product_id = ?', [id]);

      // Delete product
      await connection.execute('DELETE FROM products WHERE id = ?', [id]);

      await connection.commit();

      // Log user footprint
      await logFootprint(
        req.user ? req.user.id : 1,
        'DELETE_PRODUCT_AND_HISTORY',
        `Permanently deleted product: "${name}" (SKU: "${sku}", ID: ${id}) and all its transactional/sales history.`
      );

      res.json({ message: 'Product and all transactional history permanently deleted.' });
    } else {
      await connection.rollback();
      res.status(400).json({ error: 'Invalid delete option' });
    }
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Transaction might not have started yet
    }
    console.error('Delete Product Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
};

// Get warehouse inventory breakdown for a specific product
const getProductInventory = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT 
        w.id as warehouse_id, 
        w.name as warehouse_name, 
        w.location as warehouse_location, 
        COALESCE(i.quantity, 0) as quantity
      FROM warehouses w
      LEFT JOIN inventory i ON i.warehouse_id = w.id AND i.product_id = ?
      ORDER BY w.name
    `, [id]);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Product Inventory Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const bulkCreateProducts = async (req, res) => {
  const productsList = req.body;

  if (!Array.isArray(productsList) || productsList.length === 0) {
    return res.status(400).json({ error: 'Payload must be a non-empty array of products' });
  }

  const connection = await db.getConnection();
  let createdCount = 0;
  let skippedCount = 0;
  const errors = [];

  try {
    await connection.beginTransaction();

    for (let i = 0; i < productsList.length; i++) {
      const item = productsList[i];
      const rowNum = i + 1;
      const { name, sku, categoryName, costPrice, sellingPrice, lowStockThreshold } = item;

      if (!name || !sku || !categoryName) {
        errors.push(`Row ${rowNum}: Name, SKU, and Category Name are required.`);
        skippedCount++;
        continue;
      }

      // Check if SKU already exists
      const [existing] = await connection.execute(
        'SELECT id FROM products WHERE sku = ?',
        [sku.trim()]
      );

      if (existing.length > 0) {
        errors.push(`Row ${rowNum}: SKU "${sku}" already exists. Skipping.`);
        skippedCount++;
        continue;
      }

      // Get or create category
      let categoryId = null;
      const [catRows] = await connection.execute(
        'SELECT id FROM categories WHERE name = ?',
        [categoryName.trim()]
      );

      if (catRows.length > 0) {
        categoryId = catRows[0].id;
      } else {
        const [catResult] = await connection.execute(
          'INSERT INTO categories (name) VALUES (?)',
          [categoryName.trim()]
        );
        categoryId = catResult.insertId;
      }

      // Insert product
      await connection.execute(
        'INSERT INTO products (name, sku, category_id, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?)',
        [
          name.trim(),
          sku.trim(),
          categoryId,
          parseFloat(costPrice) || 0.00,
          parseFloat(sellingPrice) || 0.00,
          parseInt(lowStockThreshold) || 10
        ]
      );
      createdCount++;
    }

    if (errors.length === productsList.length) {
      await connection.rollback();
      return res.status(400).json({
        error: 'All products in the sheet failed validation.',
        details: errors
      });
    }

    await connection.commit();

    // Log user footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'BULK_CREATE_PRODUCTS',
      `Created ${createdCount} products via spreadsheet bulk import (skipped ${skippedCount}).`
    );

    res.status(200).json({
      message: `Bulk creation completed. Created: ${createdCount}, Skipped/Failed: ${skippedCount}`,
      createdCount,
      skippedCount,
      details: errors
    });

  } catch (error) {
    await connection.rollback();
    console.error('Bulk Create Products Error:', error);
    res.status(500).json({ error: 'Internal server error during bulk product creation.' });
  } finally {
    connection.release();
  }
};

export default {
  searchProducts,
  getAllProducts,
  getBestPerformingProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductInventory,
  bulkCreateProducts
};
