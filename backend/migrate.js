import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runMigration = async () => {
  let connection;
  try {
    console.log('Connecting to database for schema migrations...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hims_db',
    });

    // 0. Load and execute base schema.sql
    console.log('Loading base schema.sql...');
    const schemaPath = path.join(__dirname, '../db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      // Split by semicolon, filter out comments and empty statements
      const statements = schemaSql
        .split(';')
        .map(st => st.trim())
        .filter(st => st.length > 0 && !st.startsWith('--'));

      console.log(`Executing ${statements.length} schema statements...`);
      for (const statement of statements) {
        try {
          await connection.execute(statement);
        } catch (stmtErr) {
          // Ignore table/column already exists or duplicate index errors
          if (!stmtErr.message.includes('already exists') && !stmtErr.message.includes('Duplicate key')) {
            console.error('Error executing statement:', statement);
            console.error(stmtErr.message);
          }
        }
      }
      console.log('Base schema checked/applied.');
    } else {
      console.warn('schema.sql file not found at:', schemaPath);
    }

    // 1. Create Users Table if not exists
    console.log('Checking database table users...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('SUPER_ADMIN', 'ADMIN', 'USER') NOT NULL DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_username (username)
      )
    `);

    // 2. Seed Default Super Admin User (superadmin / admin1234)
    const [userRows] = await connection.execute('SELECT id FROM users WHERE username = ?', ['superadmin']);
    if (userRows.length === 0) {
      console.log('Seeding default Super Admin user...');
      await connection.execute(
        'INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, ?)',
        ['Super Administrator', 'superadmin', '$2b$10$u4g8ILfnWnw6oEOEsLthR.Nrwa21k9mXMEJf5p8S.lQwOceLiNi.u', 'SUPER_ADMIN']
      );
      console.log('Default Super Admin user seeded successfully.');
    } else {
      console.log('Default Super Admin user already exists.');
    }

    // 2.2 Add allowed_sections column to users table if missing
    console.log('Checking database table users for allowed_sections column...');
    const [userColumns] = await connection.execute('SHOW COLUMNS FROM users');
    const sectionsColExists = userColumns.some(col => col.Field === 'allowed_sections');
    if (!sectionsColExists) {
      console.log('Adding allowed_sections column to users table...');
      await connection.execute(
        "ALTER TABLE users ADD COLUMN allowed_sections VARCHAR(255) DEFAULT 'WAREHOUSE'"
      );
      console.log('allowed_sections column added successfully.');
    } else {
      console.log('allowed_sections column already exists in users.');
    }

    // 2.3 Create Footprints Table if not exists
    console.log('Checking database table footprints...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS footprints (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_footprint_user (user_id),
        INDEX idx_footprint_action (action_type),
        INDEX idx_footprint_timestamp (timestamp)
      )
    `);
    console.log('Footprints table checked/created successfully.');

    // 3. Add discount_amount column to transactions table
    console.log('Checking database table transactions for discount_amount column...');
    const [columns] = await connection.execute('SHOW COLUMNS FROM transactions');
    const discountColExists = columns.some(col => col.Field === 'discount_amount');

    if (!discountColExists) {
      console.log('Adding discount_amount column to transactions table...');
      await connection.execute(
        'ALTER TABLE transactions ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0.00'
      );
      console.log('discount_amount column added successfully.');
    } else {
      console.log('discount_amount column already exists in transactions.');
    }

    // 3.1 Add is_decommissioned column to products table if missing
    console.log('Checking database table products for is_decommissioned column...');
    const [prodColumns] = await connection.execute('SHOW COLUMNS FROM products');
    const isDecommissionedExists = prodColumns.some(col => col.Field === 'is_decommissioned');

    if (!isDecommissionedExists) {
      console.log('Adding is_decommissioned column to products table...');
      await connection.execute(
        'ALTER TABLE products ADD COLUMN is_decommissioned TINYINT(1) NOT NULL DEFAULT 0'
      );
      console.log('is_decommissioned column added successfully.');
    } else {
      console.log('is_decommissioned column already exists in products.');
    }

    // 4. Add foreign key constraint for user_id to transactions table
    console.log('Checking foreign key constraint link from transactions to users...');
    const [fkRows] = await connection.execute(`
      SELECT CONSTRAINT_NAME 
      FROM information_schema.REFERENTIAL_CONSTRAINTS 
      WHERE CONSTRAINT_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'transactions' 
        AND CONSTRAINT_NAME = 'fk_transactions_user'
    `);
    
    if (fkRows.length === 0) {
      console.log('Adding foreign key constraint for user_id to transactions table...');
      try {
        // Clean up invalid user_ids to match the seeded Super Admin user ID (1)
        await connection.execute('UPDATE transactions SET user_id = 1 WHERE user_id NOT IN (SELECT id FROM users)');
        await connection.execute(
          'ALTER TABLE transactions ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id)'
        );
        console.log('Foreign key constraint added successfully.');
      } catch (fkErr) {
        console.error('Could not add foreign key constraint on transactions.user_id:', fkErr.message);
      }
    } else {
      console.log('Foreign key constraint fk_transactions_user already exists.');
    }

    console.log('Database schema migration completed.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1); // Fail the build/startup if migration fails
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

runMigration();
