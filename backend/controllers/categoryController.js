import db from '../config/db.js';
import { logFootprint } from '../utils/footprint.js';

/**
 * Category Controller
 * Handles CRUD for hierarchical categories.
 */

// List all categories
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT c1.id, c1.name, c2.name as parent_name, c1.parent_id
      FROM categories c1
      LEFT JOIN categories c2 ON c1.parent_id = c2.id
      ORDER BY c1.name
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Categories Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new category
const createCategory = async (req, res) => {
  const { name, parentId } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  try {
    const [result] = await db.execute(
      'INSERT INTO categories (name, parent_id) VALUES (?, ?)',
      [name, parentId || null]
    );

    // Log user footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'CREATE_CATEGORY',
      `Created category: "${name}"${parentId ? ` as sub-category of parent ID ${parentId}` : ''}.`
    );

    res.status(201).json({ id: result.insertId, name, parentId });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a category
const deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch category metadata to capture name for audit logs
    const [catRows] = await db.execute('SELECT name FROM categories WHERE id = ?', [id]);
    if (catRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    const catName = catRows[0].name;

    await db.execute('DELETE FROM categories WHERE id = ?', [id]);

    // Log user footprint
    await logFootprint(
      req.user ? req.user.id : 1,
      'DELETE_CATEGORY',
      `Deleted category: "${catName}" (ID: ${id}).`
    );

    res.json({ message: `Category "${catName}" decommissioned successfully.` });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getAllCategories,
  createCategory,
  deleteCategory
};
