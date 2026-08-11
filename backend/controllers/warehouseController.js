import db from '../config/db.js';
import { logFootprint } from '../utils/footprint.js';

/**
 * Warehouse & Shop Controller
 * Manages storage locations (Warehouses) and retail locations (Shops).
 */

const getAllWarehouses = async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT id, name, location FROM warehouses WHERE type = 'WAREHOUSE' ORDER BY name");
    res.json(rows);
  } catch (error) {
    console.error('Fetch Warehouses Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllShops = async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT id, name, location FROM warehouses WHERE type = 'SHOP' ORDER BY name");
    res.json(rows);
  } catch (error) {
    console.error('Fetch Shops Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createWarehouse = async (req, res) => {
  const { name, location } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Warehouse name is required' });
  }
  try {
    const [result] = await db.execute(
      "INSERT INTO warehouses (name, location, type) VALUES (?, ?, 'WAREHOUSE')",
      [name.trim(), location ? location.trim() : '']
    );
    res.status(201).json({ id: result.insertId, message: 'Warehouse created successfully' });
  } catch (error) {
    console.error('Create Warehouse Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createShop = async (req, res) => {
  const { name, location } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Shop name is required' });
  }
  try {
    const [result] = await db.execute(
      "INSERT INTO warehouses (name, location, type) VALUES (?, ?, 'SHOP')",
      [name.trim(), location ? location.trim() : '']
    );
    res.status(201).json({ id: result.insertId, message: 'Shop created successfully' });
  } catch (error) {
    console.error('Create Shop Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getWarehouseInventory = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(`
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.cost_price,
        p.selling_price,
        i.quantity
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE i.warehouse_id = ? AND i.quantity > 0 AND p.is_decommissioned = 0
      ORDER BY p.name
    `, [id]);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Warehouse Inventory Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateFacility = async (req, res) => {
  const { id } = req.params;
  const { name, location, type } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Facility name is required' });
  }

  try {
    const [existing] = await db.execute('SELECT id FROM warehouses WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    await db.execute(
      'UPDATE warehouses SET name = ?, location = ?, type = ? WHERE id = ?',
      [name.trim(), location ? location.trim() : '', type || 'WAREHOUSE', id]
    );

    // Log footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'UPDATE_FACILITY',
      `Updated facility: "${name}" (ID: ${id}).`
    );

    res.json({ message: 'Facility updated successfully' });
  } catch (error) {
    console.error('Update Facility Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteFacility = async (req, res) => {
  const { id } = req.params;
  const purgeHistory = req.query.purgeHistory === 'true';

  try {
    // 1. Check if the facility exists
    const [facility] = await db.execute('SELECT name, type FROM warehouses WHERE id = ?', [id]);
    if (facility.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }
    const { name, type } = facility[0];

    // 2. Check if there is active inventory (quantity > 0)
    const [invRows] = await db.execute(
      'SELECT COALESCE(SUM(quantity), 0) as totalStock FROM inventory WHERE warehouse_id = ?',
      [id]
    );
    if (invRows[0].totalStock > 0) {
      return res.status(400).json({
        error: 'Cannot delete facility because it currently has active inventory stock. Please transfer or clear the stock first.'
      });
    }

    // 3. Check for transaction logs
    const [txRows] = await db.execute(
      'SELECT COUNT(*) as txCount FROM transactions WHERE warehouse_id = ?',
      [id]
    );
    if (txRows[0].txCount > 0) {
      if (!purgeHistory) {
        return res.status(400).json({
          code: 'HAS_TRANSACTIONS',
          error: 'Cannot delete facility because it has associated transaction history. It cannot be deleted to preserve audit trails.'
        });
      }
      // Delete the transactions associated with the facility to preserve integrity
      await db.execute('DELETE FROM transactions WHERE warehouse_id = ?', [id]);
    }

    // 4. Delete zero-quantity inventory mappings to avoid constraint conflicts, then delete warehouse
    await db.execute('DELETE FROM inventory WHERE warehouse_id = ?', [id]);
    await db.execute('DELETE FROM warehouses WHERE id = ?', [id]);

    // 5. Log footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'DELETE_FACILITY',
      `Permanently deleted facility: "${name}" (Type: ${type}, ID: ${id}).${purgeHistory ? ' Also purged associated transaction logs.' : ''}`
    );

    res.json({ message: 'Facility deleted successfully.' });
  } catch (error) {
    console.error('Delete Facility Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getAllWarehouses,
  getAllShops,
  createWarehouse,
  createShop,
  getWarehouseInventory,
  updateFacility,
  deleteFacility
};
