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

export default {
  getAllWarehouses,
  getAllShops,
  createWarehouse,
  createShop,
  getWarehouseInventory,
  updateFacility
};
