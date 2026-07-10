import { logFootprint } from '../utils/footprint.js';

/**
 * Stock Movement Controller
 * Handles IN/OUT transactions with atomic updates to inventory.
 */

const handleStockMovement = async (req, res, db) => {
  const { productId, productName, warehouseId, type, quantity, userId } = req.body;

  const isCompetitorSourced = req.body.isCompetitorSourced ? 1 : 0;
  const finalUserId = userId || (req.user ? req.user.id : null);

  // Basic validation (allow productName instead of productId if it is competitor-sourced)
  if ((!productId && (!isCompetitorSourced || !productName)) || !warehouseId || !type || !quantity || !finalUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['IN', 'OUT'].includes(type)) {
    return res.status(400).json({ error: 'Invalid transaction type' });
  }

  const connection = await db.getConnection();

  try {
    // 1. Start Database Transaction
    await connection.beginTransaction();

    // Verify location type if this is a sale transaction
    const isSale = req.body.isSale ? 1 : 0;
    const competitorCostPrice = isCompetitorSourced ? req.body.competitorCostPrice : null;
    const competitorSellingPrice = isCompetitorSourced ? req.body.competitorSellingPrice : null;

    if (isSale) {
      const [locRows] = await connection.execute(
        "SELECT type FROM warehouses WHERE id = ?",
        [warehouseId]
      );
      if (locRows.length === 0 || locRows[0].type !== 'SHOP') {
        throw new Error('Sales transactions can only be initiated from Shop locations');
      }
    }

    let finalProductId = productId;

    // Dynamically check/create the product if typed by the user for competitor sourcing
    if (isCompetitorSourced && productName) {
      const [prodRows] = await connection.execute(
        "SELECT id FROM products WHERE name = ? AND is_decommissioned = 0",
        [productName.trim()]
      );
      if (prodRows.length > 0) {
        finalProductId = prodRows[0].id;
      } else {
        // Create new category "Competitor Sourced" if not exists
        let categoryId = null;
        const [catRows] = await connection.execute(
          "SELECT id FROM categories WHERE name = 'Competitor Sourced'"
        );
        if (catRows.length > 0) {
          categoryId = catRows[0].id;
        } else {
          const [catResult] = await connection.execute(
            "INSERT INTO categories (name) VALUES ('Competitor Sourced')"
          );
          categoryId = catResult.insertId;
        }

        // Generate dynamic SKU
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const cleanName = productName.trim().replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
        const generatedSku = `COMP-${cleanName}-${uniqueSuffix}`;

        // Insert new product
        const [prodResult] = await connection.execute(
          "INSERT INTO products (name, sku, category_id, cost_price, selling_price) VALUES (?, ?, ?, ?, ?)",
          [
            productName.trim(),
            generatedSku,
            categoryId,
            competitorCostPrice || 0.00,
            competitorSellingPrice || 0.00
          ]
        );
        finalProductId = prodResult.insertId;
      }
    }

    let currentQuantity = 0;

    if (!isCompetitorSourced) {
      // 2. Lock inventory row for update to prevent race conditions
      // Using SELECT FOR UPDATE to ensure consistency
      const [inventoryRows] = await connection.execute(
        'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
        [finalProductId, warehouseId]
      );

      currentQuantity = inventoryRows.length > 0 ? inventoryRows[0].quantity : 0;

      // 3. Logic for OUT: Check if enough stock exists
      if (type === 'OUT') {
        if (currentQuantity < quantity) {
          throw new Error('Insufficient stock for this transaction');
        }
        currentQuantity -= quantity;
      } else {
        currentQuantity += quantity;
      }

      // 4. Update or Insert into inventory
      if (inventoryRows.length > 0) {
        await connection.execute(
          'UPDATE inventory SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
          [currentQuantity, finalProductId, warehouseId]
        );
      } else {
        // If it's an 'IN' transaction for a new product-warehouse combination
        await connection.execute(
          'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [finalProductId, warehouseId, currentQuantity]
        );
      }
    } else {
      // For competitor-sourced sales, we don't touch local inventory stock.
      // Fetch current quantity to return it, but do not change it.
      const [inventoryRows] = await connection.execute(
        'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ?',
        [finalProductId, warehouseId]
      );
      currentQuantity = inventoryRows.length > 0 ? inventoryRows[0].quantity : 0;
    }

    // 5. Create Transaction Record
    await connection.execute(
      'INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id, is_sale, is_competitor_sourced, competitor_cost_price, competitor_selling_price, discount_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [finalProductId, warehouseId, type, quantity, finalUserId, isSale, isCompetitorSourced, competitorCostPrice, competitorSellingPrice, parseFloat(req.body.discountAmount) || 0.00]
    );

    // 6. Update cumulative_quantity on products table (track total movement)
    await connection.execute(
      'UPDATE products SET cumulative_quantity = cumulative_quantity + ? WHERE id = ?',
      [quantity, finalProductId]
    );

    // 6. Commit Transaction
    await connection.commit();

    // Log user footprint
    await logFootprint(
      finalUserId, 
      'STOCK_MOVEMENT', 
      `${type.toUpperCase()} stock movement of ${quantity} units recorded for product ID ${finalProductId} at warehouse ID ${warehouseId}.`
    );

    return res.status(200).json({
      message: 'Stock movement recorded successfully',
      newQuantity: currentQuantity
    });

  } catch (error) {
    // 7. Rollback on failure (e.g., insufficient stock or DB error)
    await connection.rollback();
    console.error('Stock Movement Error:', error.message);
    
    return res.status(
      error.message === 'Insufficient stock for this transaction' || 
      error.message === 'Sales transactions can only be initiated from Shop locations' 
        ? 400 : 500
    ).json({
      error: error.message || 'An error occurred during stock movement'
    });

  } finally {
    // 8. Release connection back to pool
    connection.release();
  }
};

const handleStockTransfer = async (req, res, db) => {
  const { productId, fromWarehouseId, toWarehouseId, quantity, userId } = req.body;
  const finalUserId = userId || (req.user ? req.user.id : null);

  // Basic validation
  if (!productId || !fromWarehouseId || !toWarehouseId || !quantity || !finalUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (parseInt(fromWarehouseId) === parseInt(toWarehouseId)) {
    return res.status(400).json({ error: 'Source and destination warehouses must be different' });
  }

  if (parseInt(quantity) <= 0) {
    return res.status(400).json({ error: 'Quantity must be greater than 0' });
  }

  const connection = await db.getConnection();

  try {
    // 1. Start Database Transaction
    await connection.beginTransaction();

    // 2. Lock source warehouse inventory row
    const [fromRows] = await connection.execute(
      'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
      [productId, fromWarehouseId]
    );

    const currentFromQty = fromRows.length > 0 ? fromRows[0].quantity : 0;

    // Check if source has enough stock
    if (currentFromQty < quantity) {
      throw new Error('Insufficient stock in the source warehouse for this transfer');
    }

    // 3. Lock destination warehouse inventory row
    const [toRows] = await connection.execute(
      'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
      [productId, toWarehouseId]
    );

    const currentToQty = toRows.length > 0 ? toRows[0].quantity : 0;

    // 4. Update source warehouse quantity
    await connection.execute(
      'UPDATE inventory SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
      [currentFromQty - quantity, productId, fromWarehouseId]
    );

    // 5. Update destination warehouse quantity
    if (toRows.length > 0) {
      await connection.execute(
        'UPDATE inventory SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
        [currentToQty + quantity, productId, toWarehouseId]
      );
    } else {
      await connection.execute(
        'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
        [productId, toWarehouseId, quantity]
      );
    }

    // 6. Create Transaction Records (both OUT from source and IN to destination)
    await connection.execute(
      'INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id) VALUES (?, ?, "OUT", ?, ?)',
      [productId, fromWarehouseId, quantity, finalUserId]
    );
    await connection.execute(
      'INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id) VALUES (?, ?, "IN", ?, ?)',
      [productId, toWarehouseId, quantity, finalUserId]
    );

    // 7. Commit Transaction
    await connection.commit();

    // Log user footprint
    await logFootprint(
      finalUserId, 
      'STOCK_TRANSFER', 
      `Transferred ${quantity} units of product ID ${productId} from warehouse ID ${fromWarehouseId} to warehouse ID ${toWarehouseId}.`
    );

    return res.status(200).json({
      message: 'Stock transfer completed successfully',
      sourceQuantity: currentFromQty - quantity,
      destQuantity: currentToQty + quantity
    });

  } catch (error) {
    // 8. Rollback on failure
    await connection.rollback();
    console.error('Stock Transfer Error:', error.message);
    
    return res.status(error.message.includes('Insufficient stock') ? 400 : 500).json({
      error: error.message || 'An error occurred during stock transfer'
    });

  } finally {
    // 9. Release connection
    connection.release();
  }
};

const bulkStockMovements = async (req, res, db) => {
  const movementsList = req.body;

  if (!Array.isArray(movementsList) || movementsList.length === 0) {
    return res.status(400).json({ error: 'Payload must be a non-empty array of stock movements' });
  }

  const connection = await db.getConnection();
  let successCount = 0;
  const errors = [];

  try {
    await connection.beginTransaction();

    for (let i = 0; i < movementsList.length; i++) {
      const item = movementsList[i];
      const rowNum = i + 1;
      const { productName, warehouseName, type, quantity, userId } = item;
      const finalUserId = userId || (req.user ? req.user.id : 1);

      if (!productName || !warehouseName || !type || !quantity || !finalUserId) {
        errors.push(`Row ${rowNum}: Product Name, Warehouse/Shop Name, Type, Quantity, and User ID are required.`);
        continue;
      }

      if (!['IN', 'OUT'].includes(type.toUpperCase())) {
        errors.push(`Row ${rowNum}: Type must be IN or OUT.`);
        continue;
      }

      const movementQty = parseInt(quantity);
      if (isNaN(movementQty) || movementQty <= 0) {
        errors.push(`Row ${rowNum}: Quantity must be a positive integer.`);
        continue;
      }

      // Find product by Name
      const [prodRows] = await connection.execute(
        'SELECT id FROM products WHERE name = ? AND is_decommissioned = 0',
        [productName.trim()]
      );

      if (prodRows.length === 0) {
        errors.push(`Row ${rowNum}: Product "${productName}" not found in system catalog.`);
        continue;
      }
      const productId = prodRows[0].id;

      // Find warehouse/shop by name
      const [wareRows] = await connection.execute(
        'SELECT id, type FROM warehouses WHERE name = ?',
        [warehouseName.trim()]
      );

      if (wareRows.length === 0) {
        errors.push(`Row ${rowNum}: Warehouse or Shop named "${warehouseName}" not found.`);
        continue;
      }
      const warehouseId = wareRows[0].id;
      const warehouseType = wareRows[0].type;

      // Check Shop restriction for Sales
      const isSale = (type.toUpperCase() === 'OUT' && warehouseType === 'SHOP') ? 1 : 0;
      if (type.toUpperCase() === 'OUT' && isSale === 0 && warehouseType !== 'SHOP') {
        // Allow outbound movements from warehouse as well, but only if they have enough stock.
      }

      // Lock row to prevent race conditions
      const [invRows] = await connection.execute(
        'SELECT quantity FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
        [productId, warehouseId]
      );

      let currentQty = invRows.length > 0 ? invRows[0].quantity : 0;

      if (type.toUpperCase() === 'OUT') {
        if (currentQty < movementQty) {
          errors.push(`Row ${rowNum}: Insufficient stock in "${warehouseName}" for product "${productName}". Available: ${currentQty}, Requested: ${movementQty}.`);
          continue;
        }
        currentQty -= movementQty;
      } else {
        currentQty += movementQty;
      }

      // Update or Insert inventory
      if (invRows.length > 0) {
        await connection.execute(
          'UPDATE inventory SET quantity = ? WHERE product_id = ? AND warehouse_id = ?',
          [currentQty, productId, warehouseId]
        );
      } else {
        await connection.execute(
          'INSERT INTO inventory (product_id, warehouse_id, quantity) VALUES (?, ?, ?)',
          [productId, warehouseId, currentQty]
        );
      }

      // Record transaction
      await connection.execute(
        'INSERT INTO transactions (product_id, warehouse_id, type, quantity, user_id, is_sale) VALUES (?, ?, ?, ?, ?, ?)',
        [productId, warehouseId, type.toUpperCase(), movementQty, parseInt(finalUserId) || 1, isSale]
      );

      // Update cumulative quantity
      await connection.execute(
        'UPDATE products SET cumulative_quantity = cumulative_quantity + ? WHERE id = ?',
        [movementQty, productId]
      );

      successCount++;
    }

    if (errors.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: 'Validation failed on one or more rows. Entire batch transaction aborted.',
        details: errors
      });
    }

    await connection.commit();

    // Log user footprint
    const activeUserId = req.user ? req.user.id : 1;
    await logFootprint(
      activeUserId, 
      'BULK_IMPORT_MOVEMENTS', 
      `Successfully logged ${successCount} transactions via bulk stock movement sheet upload.`
    );

    res.status(200).json({
      message: `Bulk movements recorded successfully! Total: ${successCount} transactions.`,
      successCount
    });

  } catch (error) {
    await connection.rollback();
    console.error('Bulk Stock Movements Error:', error);
    res.status(500).json({ error: 'Internal server error during bulk stock movement execution.' });
  } finally {
    connection.release();
  }
};

export default {
  handleStockMovement,
  handleStockTransfer,
  bulkStockMovements
};
