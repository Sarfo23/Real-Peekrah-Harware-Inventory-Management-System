import express from 'express';
import db from '../config/db.js';
import inventoryController from '../controllers/inventoryController.js';
import productController from '../controllers/productController.js';
import warehouseController from '../controllers/warehouseController.js';
import categoryController from '../controllers/categoryController.js';
import authController from '../controllers/authController.js';
import { authenticateToken, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public Authentication Routes
 */
router.post('/auth/login', (req, res) => authController.login(req, res, db));

/**
 * Apply Authentication Middleware Globally to all endpoints below
 */
router.use(authenticateToken);

/**
 * Protected Session Profiles
 */
router.get('/auth/me', authController.getMe);
router.post('/auth/logout', authController.logout);

/**
 * Super Admin User Management & Audit Routes
 */
router.get('/users', authorizeRoles('SUPER_ADMIN'), (req, res) => authController.getUsers(req, res, db));
router.post('/users', authorizeRoles('SUPER_ADMIN'), (req, res) => authController.createUser(req, res, db));
router.put('/users/:id/role', authorizeRoles('SUPER_ADMIN'), (req, res) => authController.updateUserRole(req, res, db));
router.delete('/users/:id', authorizeRoles('SUPER_ADMIN'), (req, res) => authController.deleteUser(req, res, db));
router.get('/footprints', authorizeRoles('SUPER_ADMIN'), (req, res) => authController.getFootprints(req, res, db));

/**
 * Inventory & Audit Log Routes
 */
router.post('/inventory/move', (req, res) => 
  inventoryController.handleStockMovement(req, res, db)
);

router.post('/inventory/transfer', (req, res) => 
  inventoryController.handleStockTransfer(req, res, db)
);

router.post('/inventory/bulk-move', (req, res) => 
  inventoryController.bulkStockMovements(req, res, db)
);

// Fetch complete transaction audit trail
router.get('/transactions/history', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        t.id,
        p.name as product_name,
        p.sku,
        w.name as warehouse_name,
        t.type,
        t.quantity,
        t.timestamp,
        t.is_competitor_sourced,
        t.competitor_cost_price,
        t.competitor_selling_price,
        t.discount_amount
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      JOIN warehouses w ON t.warehouse_id = w.id
      ORDER BY t.timestamp DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Audit History Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Product & Analytics Routes
 */
router.post('/products', productController.createProduct);
router.post('/products/bulk-create', productController.bulkCreateProducts);
router.get('/products/search', productController.searchProducts);
router.get('/products', productController.getAllProducts);
router.put('/products/:id', productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.get('/products/:id/inventory', productController.getProductInventory);
router.get('/analytics/best-product', productController.getBestPerformingProduct);
  router.get('/analytics/daily-profit', async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT
          COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - t.discount_amount),0) AS daily_revenue,
          COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)),0) AS daily_cost,
          COALESCE(SUM(t.quantity * (IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)) - t.discount_amount),0) AS daily_profit
        FROM transactions t
        JOIN products p ON t.product_id = p.id
        WHERE t.is_sale = 1 AND DATE(t.timestamp) = CURDATE()
      `);
      res.json({
        revenue: rows[0].daily_revenue,
        cost: rows[0].daily_cost,
        profit: rows[0].daily_profit
      });
    } catch (error) {
      console.error('Fetch Daily Profit Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

// Fetch Flexible Sales Report with Summary, Warehouse Breakdown, and Transaction Logs
router.get('/analytics/sales-report', async (req, res) => {
  try {
    let { queryType, queryValue } = req.query;

    // If no query parameters, determine default date
    if (!queryType || !queryValue) {
      const [latestTx] = await db.execute(`
        SELECT DATE(timestamp) as latest_date 
        FROM transactions 
        WHERE is_sale = 1 
        ORDER BY timestamp DESC 
        LIMIT 1
      `);

      if (latestTx.length > 0 && latestTx[0].latest_date) {
        let dateVal = latestTx[0].latest_date;
        if (dateVal instanceof Date) {
          const yyyy = dateVal.getFullYear();
          const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
          const dd = String(dateVal.getDate()).padStart(2, '0');
          queryValue = `${yyyy}-${mm}-${dd}`;
        } else {
          queryValue = String(dateVal);
        }
        queryType = 'day';
      } else {
        const todayObj = new Date();
        const yyyy = todayObj.getFullYear();
        const mm = String(todayObj.getMonth() + 1).padStart(2, '0');
        const dd = String(todayObj.getDate()).padStart(2, '0');
        queryValue = `${yyyy}-${mm}-${dd}`;
        queryType = 'day';
      }
    }

    let sqlWhere = '';
    let sqlParams = [];

    if (queryType === 'day') {
      sqlWhere = 'DATE(t.timestamp) = ?';
      sqlParams = [queryValue];
    } else if (queryType === 'month') {
      sqlWhere = "DATE_FORMAT(t.timestamp, '%Y-%m') = ?";
      sqlParams = [queryValue];
    } else if (queryType === 'year') {
      sqlWhere = 'YEAR(t.timestamp) = ?';
      sqlParams = [parseInt(queryValue) || new Date().getFullYear()];
    } else {
      return res.status(400).json({ error: 'Invalid queryType. Must be day, month, or year.' });
    }

    // 1. Fetch Summary Metrics
    const [summaryRows] = await db.execute(`
      SELECT
        COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - t.discount_amount), 0) AS revenue,
        COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)), 0) AS cost,
        COALESCE(SUM(t.quantity * (IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)) - t.discount_amount), 0) AS profit,
        COALESCE(SUM(t.quantity), 0) AS units_sold
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      JOIN warehouses w ON t.warehouse_id = w.id
      WHERE t.is_sale = 1 AND w.type = 'SHOP' AND ${sqlWhere}
    `, sqlParams);

    // 2. Fetch Shop (Warehouse) Breakdown
    const [shopRows] = await db.execute(`
      SELECT
        w.id as warehouse_id,
        w.name as warehouse_name,
        w.location as warehouse_location,
        COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - t.discount_amount), 0) AS revenue,
        COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)), 0) AS cost,
        COALESCE(SUM(t.quantity * (IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price)) - t.discount_amount), 0) AS profit,
        COALESCE(SUM(t.quantity), 0) AS units_sold
      FROM warehouses w
      JOIN transactions t ON t.warehouse_id = w.id
      JOIN products p ON t.product_id = p.id
      WHERE t.is_sale = 1 AND w.type = 'SHOP' AND ${sqlWhere}
      GROUP BY w.id, w.name, w.location
      ORDER BY revenue DESC
    `, sqlParams);

    // 3. Fetch Recent Sales Transactions
    const [txRows] = await db.execute(`
      SELECT
        t.id,
        p.name as product_name,
        p.sku,
        w.name as warehouse_name,
        t.quantity,
        (t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - t.discount_amount) as revenue,
        ((t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - t.discount_amount) - (t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price))) as profit,
        t.timestamp,
        t.is_competitor_sourced,
        t.competitor_cost_price,
        t.competitor_selling_price,
        t.discount_amount
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      JOIN warehouses w ON t.warehouse_id = w.id
      WHERE t.is_sale = 1 AND w.type = 'SHOP' AND ${sqlWhere}
      ORDER BY t.timestamp DESC
    `, sqlParams);

    res.json({
      queryType,
      queryValue,
      summary: summaryRows[0],
      shopsBreakdown: shopRows,
      transactions: txRows
    });

  } catch (error) {
    console.error('Fetch Sales Report Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch High Density Daily Ledger Summary Metrics
router.get('/analytics/daily-summary', async (req, res) => {
  try {
    // 1. Fetch total items moved IN today
    const [inRows] = await db.execute(`
      SELECT COALESCE(SUM(quantity), 0) as total_in 
      FROM transactions 
      WHERE type = 'IN' AND is_competitor_sourced = 0 AND DATE(timestamp) = CURDATE()
    `);
    
    // 2. Fetch total items moved OUT today (exclude competitor-sourced sales as they don't affect local inventory)
    const [outRows] = await db.execute(`
      SELECT COALESCE(SUM(quantity), 0) as total_out 
      FROM transactions 
      WHERE type = 'OUT' AND is_competitor_sourced = 0 AND DATE(timestamp) = CURDATE()
    `);

    // 3. Current absolute inventory sum across the entire platform
    const [currentStockRows] = await db.execute(`
      SELECT COALESCE(SUM(quantity), 0) as total_current 
      FROM inventory
    `);

    const todayIn = parseInt(inRows[0].total_in || 0);
    const todayOut = parseInt(outRows[0].total_out || 0);
    const currentStock = parseInt(currentStockRows[0].total_current || 0);

    // 4. Back-calculate Opening Stock for the day:
    const openingStock = currentStock - todayIn + todayOut;
    const closingStock = currentStock;

    // 5. Fetch breakdown summary by warehouse location for today (excluding competitor-sourced)
    const [warehouseBreakdown] = await db.execute(`
      SELECT 
        w.name as warehouse_name,
        COUNT(t.id) as transaction_count,
        COALESCE(SUM(IF(t.type = 'IN', t.quantity, 0)), 0) as total_in,
        COALESCE(SUM(IF(t.type = 'OUT', t.quantity, 0)), 0) as total_out
      FROM warehouses w
      LEFT JOIN transactions t ON w.id = t.warehouse_id AND t.is_competitor_sourced = 0 AND DATE(t.timestamp) = CURDATE()
      GROUP BY w.id
    `);

    res.json({
      openingStock,
      closingStock,
      todayIn,
      todayOut,
      netChange: todayIn - todayOut,
      timestamp: new Date(),
      warehouseBreakdown
    });
  } catch (error) {
    console.error('Fetch Daily Summary Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch Sales Grouped by Shop and Day
router.get('/sales/daily-summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        DATE(t.timestamp) as sale_date,
        w.name as shop_name,
        w.location as shop_location,
        COUNT(t.id) as transactions_count,
        SUM(t.quantity) as total_units_sold,
        COALESCE(SUM(t.quantity * IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price)), 0) as total_revenue,
        COALESCE(SUM(t.quantity * (IF(t.is_competitor_sourced = 1, t.competitor_selling_price, p.selling_price) - IF(t.is_competitor_sourced = 1, t.competitor_cost_price, p.cost_price))), 0) as total_profit
      FROM transactions t
      JOIN products p ON t.product_id = p.id
      JOIN warehouses w ON t.warehouse_id = w.id
      WHERE t.is_sale = 1
      GROUP BY DATE(t.timestamp), w.id
      ORDER BY sale_date DESC, shop_name ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Fetch Daily Sales Summary Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Category Routes
 */
router.get('/categories', categoryController.getAllCategories);
router.post('/categories', categoryController.createCategory);
router.delete('/categories/:id', authorizeRoles('SUPER_ADMIN'), categoryController.deleteCategory);

/**
 * Warehouse Routes
 */
router.get('/warehouses', warehouseController.getAllWarehouses);
router.post('/warehouses', warehouseController.createWarehouse);
router.get('/shops', warehouseController.getAllShops);
router.post('/shops', warehouseController.createShop);
router.get('/warehouses/:id/inventory', warehouseController.getWarehouseInventory);

export default router;
